# ===========================================================================
# Directus registration for the Application Form schema (VOS Dummy)
# Run AFTER application_form_2026-09-02.sql has been applied in DBeaver.
#
#   powershell -File _migration-scripts\application_form_directus_register.ps1
#
# It: reconciles the schema cache, registers the 9 new collections as metadata
# over the existing tables, nudges `applicant` to pick up name_normalized,
# creates the 10 relations (so nested editors work), reconciles again, verifies.
# Every call is wrapped -- "already exists" errors are expected and fine.
# ===========================================================================

$base = "http://100.110.197.61:8056"
$h    = @{ Authorization = "Bearer AAKv73dkIV8DfAIA5vEt3eXVdIebzmBW" }

function J($o) { $o | ConvertTo-Json -Depth 10 -Compress }

# --- 0. reconcile cache so Directus sees the new tables/columns -------------
try {
    Invoke-RestMethod -Method Post -Uri "$base/utils/cache/clear" -Headers $h | Out-Null
    Write-Host "0. cache cleared" -ForegroundColor Green
} catch { Write-Host "0. cache clear: $($_.ErrorDetails.Message)" -ForegroundColor Yellow }

# --- 1. register the 9 new collections -------------------------------------
$new = @(
    "application","application_family_member","application_company_relative",
    "application_education","application_work_experience","application_reference",
    "application_training","application_licensure_exam","application_attachment"
)
foreach ($c in $new) {
    $done = $false
    # This instance errors on POST for an already-existing table; PATCH attaches
    # metadata to the untracked table. Try PATCH first, POST as fallback.
    try {
        Invoke-RestMethod -Method Patch -Uri "$base/collections/$c" -Headers $h `
            -ContentType "application/json" `
            -Body (J @{ meta = @{ icon = "description"; note = "Application Form module" } }) | Out-Null
        $done = $true; Write-Host "1. registered (PATCH) $c" -ForegroundColor Green
    } catch {
        try {
            Invoke-RestMethod -Method Post -Uri "$base/collections" -Headers $h `
                -ContentType "application/json" `
                -Body (J @{ collection = $c; meta = @{ icon = "description" }; schema = @{} }) | Out-Null
            $done = $true; Write-Host "1. registered (POST) $c" -ForegroundColor Green
        } catch {
            Write-Host "1. FAILED $c : $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
}

# --- 2. nudge `applicant` for the new generated column name_normalized ------
# applicant is already tracked; a cache clear usually surfaces the column.
# If it doesn't, this POST reconciles it (a 'duplicate column' error here is
# expected and harmless -- it still forces the re-read).
try {
    Invoke-RestMethod -Method Post -Uri "$base/fields/applicant" -Headers $h `
        -ContentType "application/json" `
        -Body (J @{ field = "name_normalized"; type = "string";
                    meta = @{ interface = "input"; readonly = $true; width = "half";
                              note = "auto lowercased/trimmed from full_name (search helper)" } }) | Out-Null
    Write-Host "2. applicant.name_normalized registered" -ForegroundColor Green
} catch {
    Write-Host "2. applicant.name_normalized: $($_.ErrorDetails.Message) (usually still fine)" -ForegroundColor DarkGray
}

# --- 3. relations (M2O per FK + the reverse O2M alias on the parent) --------
# schema is omitted on purpose -- the DB foreign keys already exist.
$rel = @(
    @{ c="application";                  f="applicant_id";   r="applicant";   one="applications" },
    @{ c="application_family_member";    f="application_id"; r="application"; one="family_members" },
    @{ c="application_company_relative"; f="application_id"; r="application"; one="company_relatives" },
    @{ c="application_education";        f="application_id"; r="application"; one="education" },
    @{ c="application_work_experience";  f="application_id"; r="application"; one="work_experience" },
    @{ c="application_reference";        f="application_id"; r="application"; one="references_list" },
    @{ c="application_training";         f="application_id"; r="application"; one="trainings" },
    @{ c="application_licensure_exam";   f="application_id"; r="application"; one="licensure_exams" },
    @{ c="application_attachment";       f="application_id"; r="application"; one="attachments" }
)
foreach ($x in $rel) {
    try {
        Invoke-RestMethod -Method Post -Uri "$base/relations" -Headers $h `
            -ContentType "application/json" `
            -Body (J @{ collection = $x.c; field = $x.f; related_collection = $x.r;
                        meta = @{ one_field = $x.one } }) | Out-Null
        Write-Host "3. relation $($x.c).$($x.f) -> $($x.r)" -ForegroundColor Green
    } catch {
        Write-Host "3. relation $($x.c).$($x.f): $($_.ErrorDetails.Message)" -ForegroundColor Yellow
    }
}

# --- 4. optional: set the file-field interfaces ---------------------------
$fileFields = @(
    @{ c="application";            f="photo_file" },
    @{ c="application";            f="signature_file" },
    @{ c="application_attachment"; f="file" }
)
foreach ($x in $fileFields) {
    try {
        Invoke-RestMethod -Method Patch -Uri "$base/fields/$($x.c)/$($x.f)" -Headers $h `
            -ContentType "application/json" `
            -Body (J @{ meta = @{ interface = "file"; special = @("file") };
                        schema = @{ data_type = "char"; max_length = 36 } }) | Out-Null
        Write-Host "4. file interface $($x.c).$($x.f)" -ForegroundColor Green
    } catch {
        Write-Host "4. file interface $($x.c).$($x.f): $($_.ErrorDetails.Message) (set it in the UI instead)" -ForegroundColor DarkGray
    }
}

# --- 6. reverse aliases -> handled by application_form_relations_recover.ps1
# DO NOT use PATCH /relations/{c}/{f} here -- on this Directus version it
# delete-then-reinserts and the reinsert fails, wiping the relation. Use
# POST /relations (create with meta.one_field) instead, which the recover
# script does for all 10 relations at once.

# --- 5. reconcile again + verify ----------------------------------------
try { Invoke-RestMethod -Method Post -Uri "$base/utils/cache/clear" -Headers $h | Out-Null } catch {}
Start-Sleep -Seconds 1
Write-Host "`n--- verification (field counts) ---"
foreach ($c in @("applicant") + $new) {
    try {
        $f = Invoke-RestMethod -Method Get -Uri "$base/fields/$c" -Headers $h
        Write-Host ("  {0,-32} {1} fields" -f $c, $f.data.Count) -ForegroundColor Green
    } catch {
        Write-Host ("  {0,-32} NOT VISIBLE  -- restart the Directus container" -f $c) -ForegroundColor Red
    }
}
Write-Host "`nIf any collection shows NOT VISIBLE or 0 fields, restart the Directus"
Write-Host "container (the guaranteed reconcile -- lesson 275), then re-run step 5."
