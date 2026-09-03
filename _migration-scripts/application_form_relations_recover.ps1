# ===========================================================================
# RECOVERY: recreate the Directus relation METADATA for the application family.
# The database foreign keys are intact -- only directus_relations rows were lost
# (a bad PATCH /relations earlier deleted-then-failed-to-reinsert them).
#
#   powershell -File _migration-scripts\application_form_relations_recover.ps1
#
# Uses POST /relations (correct when the metadata row is absent). No `schema`
# key -> Directus writes metadata only, never touches the DB.
# ===========================================================================

$base = "http://100.110.197.61:8056"
$h    = @{ Authorization = "Bearer AAKv73dkIV8DfAIA5vEt3eXVdIebzmBW" }
function J($o){ $o | ConvertTo-Json -Depth 12 -Compress }

$rels = @(
    @{ c="application";                  f="applicant_id";   r="applicant";   one="applications";       s=$null  },
    @{ c="application_family_member";    f="application_id"; r="application"; one="family_members";     s="sort" },
    @{ c="application_company_relative"; f="application_id"; r="application"; one="company_relatives";  s="sort" },
    @{ c="application_education";        f="application_id"; r="application"; one="education";          s="sort" },
    @{ c="application_work_experience";  f="application_id"; r="application"; one="work_experience";    s="sort" },
    @{ c="application_reference";        f="application_id"; r="application"; one="references_list";    s="sort" },
    @{ c="application_training";         f="application_id"; r="application"; one="trainings";          s="sort" },
    @{ c="application_licensure_exam";   f="application_id"; r="application"; one="licensure_exams";    s="sort" },
    @{ c="application_attachment";       f="application_id"; r="application"; one="attachments";        s="sort" },
    @{ c="quiz_attempt";                 f="application_id"; r="application"; one="quiz_attempts";      s=$null  }
)

$fail = @()
foreach ($x in $rels) {
    $meta = @{ one_field = $x.one }
    if ($x.s) { $meta.sort_field = $x.s }
    try {
        Invoke-RestMethod -Method Post -Uri "$base/relations" -Headers $h `
            -ContentType "application/json" `
            -Body (J @{ collection = $x.c; field = $x.f; related_collection = $x.r; meta = $meta }) | Out-Null
        Write-Host ("  OK   {0}.{1} -> {2}  (alias {3})" -f $x.c, $x.f, $x.r, $x.one) -ForegroundColor Green
    } catch {
        Write-Host ("  FAIL {0}.{1} : {2}" -f $x.c, $x.f, $_.ErrorDetails.Message) -ForegroundColor Red
        $fail += $x
    }
}

try { Invoke-RestMethod -Method Post -Uri "$base/utils/cache/clear" -Headers $h | Out-Null } catch {}
Start-Sleep -Seconds 1

$now = (Invoke-RestMethod -Method Get -Uri "$base/relations?limit=-1" -Headers $h).data `
        | Where-Object { $_.related_collection -eq "application" -or $_.collection -like "application*" }
Write-Host ("`napplication-family relations now: {0} (expected 10)" -f ($now | Measure-Object).Count) -ForegroundColor Cyan

if ($fail.Count) {
    Write-Host "`nPOST failed for $($fail.Count) -- Directus still thinks a relationship exists." -ForegroundColor Yellow
    Write-Host "Fallback: run this in DBeaver against VOS Dummy, then restart the Directus container:`n" -ForegroundColor Yellow
    Write-Host "INSERT INTO directus_relations (many_collection, many_field, one_collection, one_field) VALUES"
    $lines = $fail | ForEach-Object {
        "  ('{0}', '{1}', '{2}', {3})" -f $_.c, $_.f, $_.r, ($(if ($_.one) { "'$($_.one)'" } else { "NULL" }))
    }
    Write-Host (($lines -join ",`n") + ";")
}
