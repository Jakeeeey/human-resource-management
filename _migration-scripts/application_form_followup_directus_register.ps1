# ===========================================================================
# Directus reconcile for application_form_followup_2026-09-02.sql
# Run AFTER that SQL is applied in DBeaver.
#
#   powershell -File _migration-scripts\application_form_followup_directus_register.ps1
#
# - refreshes application.status dropdown choices (now incl. "Final Interview")
# - registers application.quiz_score (integer) and quiz_passed (boolean)
# - registers quiz_attempt.application_id + its M2O relation to application
# ===========================================================================

$base = "http://100.110.197.61:8056"
$h    = @{ Authorization = "Bearer AAKv73dkIV8DfAIA5vEt3eXVdIebzmBW" }
function J($o){ $o | ConvertTo-Json -Depth 12 -Compress }

# --- 0. reconcile so Directus sees the new columns ------------------------
try { Invoke-RestMethod -Method Post -Uri "$base/utils/cache/clear" -Headers $h | Out-Null; Write-Host "0. cache cleared" -ForegroundColor Green }
catch { Write-Host "0. $($_.ErrorDetails.Message)" -ForegroundColor Yellow }
Start-Sleep -Seconds 2

# --- 1. application.status choices --------------------------------------
$statuses = @(
    'Draft','Submitted','Quiz Completed','Initial Interview','Final Interview',
    'Verdict Pending','For Scheduling','Scheduled','For Job Offer',
    'Job Offer Approved','Offer Signed','For Requirements',
    'Hired','Rejected','Withdrawn','Talent Pool'
)
$choices = $statuses | ForEach-Object { @{ text = $_; value = $_ } }
try {
    Invoke-RestMethod -Method Patch -Uri "$base/fields/application/status" -Headers $h `
        -ContentType "application/json" `
        -Body (J @{ meta = @{ interface = "select-dropdown"; options = @{ choices = $choices } } }) | Out-Null
    Write-Host "1. application.status choices refreshed (16, incl. Final Interview)" -ForegroundColor Green
} catch { Write-Host "1. status choices: $($_.ErrorDetails.Message)" -ForegroundColor Yellow }

# --- 2. application.quiz_score / quiz_passed --------------------------
try {
    Invoke-RestMethod -Method Patch -Uri "$base/fields/application/quiz_score" -Headers $h `
        -ContentType "application/json" `
        -Body (J @{ meta = @{ interface = "input"; note = "denormalized from quiz_attempt at completion" } }) | Out-Null
    Write-Host "2. application.quiz_score registered" -ForegroundColor Green
} catch { Write-Host "2. quiz_score: $($_.ErrorDetails.Message) (restart the container if 'not found')" -ForegroundColor Yellow }

try {
    Invoke-RestMethod -Method Patch -Uri "$base/fields/application/quiz_passed" -Headers $h `
        -ContentType "application/json" `
        -Body (J @{ type = "boolean"; meta = @{ interface = "boolean"; special = @("cast-boolean") } }) | Out-Null
    Write-Host "2. application.quiz_passed registered (boolean)" -ForegroundColor Green
} catch { Write-Host "2. quiz_passed: $($_.ErrorDetails.Message) (restart the container if 'not found')" -ForegroundColor Yellow }

# --- 3. quiz_attempt.application_id + relation ---------------------
# The relation itself is (re)created by application_form_relations_recover.ps1
# (it POSTs all 10 application-family relations, incl. this one). Do NOT PATCH
# /relations/{c}/{f} here -- it wipes the row on this Directus version.
try {
    Invoke-RestMethod -Method Patch -Uri "$base/fields/quiz_attempt/application_id" -Headers $h `
        -ContentType "application/json" `
        -Body (J @{ meta = @{ interface = "select-dropdown-m2o"; note = "the specific application this attempt belongs to" } }) | Out-Null
    Write-Host "3. quiz_attempt.application_id field interface set" -ForegroundColor Green
} catch { Write-Host "3. field interface: $($_.ErrorDetails.Message)" -ForegroundColor DarkGray }

# --- 4. reconcile + verify -------------------------------------------
try { Invoke-RestMethod -Method Post -Uri "$base/utils/cache/clear" -Headers $h | Out-Null } catch {}
Start-Sleep -Seconds 1
Write-Host "`n--- verification ---"
$check = @(
    @{ c = "application";  f = "quiz_score" },
    @{ c = "application";  f = "quiz_passed" },
    @{ c = "quiz_attempt"; f = "application_id" }
)
foreach ($x in $check) {
    try {
        Invoke-RestMethod -Method Get -Uri "$base/fields/$($x.c)/$($x.f)" -Headers $h | Out-Null
        Write-Host ("  {0}.{1}  OK" -f $x.c, $x.f) -ForegroundColor Green
    } catch {
        Write-Host ("  {0}.{1}  NOT VISIBLE -- restart the Directus container, re-run" -f $x.c, $x.f) -ForegroundColor Red
    }
}
$st = Invoke-RestMethod -Method Get -Uri "$base/fields/application/status" -Headers $h
$n = ($st.data.meta.options.choices | Measure-Object).Count
Write-Host ("  application.status dropdown choices: {0}" -f $n) -ForegroundColor Green
