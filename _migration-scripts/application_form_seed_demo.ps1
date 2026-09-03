# ===========================================================================
# Seeds ONE realistic Application Form record (+ all child rows) into VOS Dummy
# so you can walk the senior through it in Directus > Content > Application.
# Run AFTER the SQL migration + the register script.
#
#   powershell -File _migration-scripts\application_form_seed_demo.ps1
#
# Uses only the M2O foreign keys (definitely present) -- creates the parent,
# then each child batch with application_id set. Marked "(APPFORM DEMO)".
# Removal one-liner is printed at the end (children cascade).
# ===========================================================================

$base = "http://100.110.197.61:8056"
$h    = @{ Authorization = "Bearer AAKv73dkIV8DfAIA5vEt3eXVdIebzmBW" }
function J($o){ $o | ConvertTo-Json -Depth 12 -Compress }
function Post($path,$obj){ Invoke-RestMethod -Method Post -Uri "$base$path" -Headers $h -ContentType "application/json" -Body (J $obj) }
$now = (Get-Date).ToString("s")

# 1. applicant --------------------------------------------------------------
$applicantId = (Post "/items/applicant" @{
    full_name            = "Juan Dela Cruz (APPFORM DEMO)"
    position_applied_for = "Warehouse Associate"
}).data.id
Write-Host "applicant id  = $applicantId" -ForegroundColor Cyan

# 2. application (flat) ---------------------------------------------------
$id = (Post "/items/application" @{
    applicant_id                = $applicantId
    position_applied_for        = "Warehouse Associate"
    how_heard                   = "Walk-In"
    first_name = "Juan"; middle_name = "Santos"; last_name = "Dela Cruz"; nickname = "Johnny"
    address                     = "123 Rizal St, Dagupan City, Pangasinan"
    phone = "09171234567"; email = "juan.demo@example.com"
    birthdate = "1998-03-12"; birthplace = "Dagupan City"
    sex = "Male"; height_cm = 170.5; weight_kg = 65.0
    civil_status = "Single"; religion = "Roman Catholic"
    sss_no = "34-1234567-8"; tin = "123-456-789-000"
    philhealth_no = "12-345678901-2"; pagibig_no = "1234-5678-9012"
    drivers_license_no = "N01-23-456789"
    special_skills = "Forklift operation, WMS/inventory systems"
    languages = "Filipino, English, Ilocano"
    organizational_affiliations = "None"
    hobbies_interests = "Basketball, cycling"
    has_company_relatives = 1
    certification_agreed = 1
    certification_text_snapshot = "I certify that the information provided in this application is true and correct to the best of my knowledge."
    certification_signed_at = $now
    status = "Submitted"; source = "hrm-assisted"; submitted_at = $now
}).data.id
Write-Host "application id = $id" -ForegroundColor Cyan

# 3. child rows (batch per table) --------------------------------------
Post "/items/application_family_member" @(
  @{ application_id=$id; relation="Father";  name="Pedro Dela Cruz"; age=58; occupation="Farmer";  company="Self-employed"; sort=0 }
  @{ application_id=$id; relation="Mother";  name="Maria Dela Cruz"; age=55; occupation="Teacher"; company="DepEd";        sort=1 }
  @{ application_id=$id; relation="Sibling"; name="Ana Dela Cruz";   age=25; occupation="Nurse";   company="R1MC";         sort=2 }
  @{ application_id=$id; relation="Dependent"; name="Baby Dela Cruz"; age=2; education="N/A";                              sort=3 }
) | Out-Null

Post "/items/application_company_relative" @(
  @{ application_id=$id; name="Rosa Dela Cruz"; relationship="Aunt"; position="Cashier"; area_assignment="Dagupan Branch"; sort=0 }
) | Out-Null

Post "/items/application_education" @(
  @{ application_id=$id; level="Elementary";  school_name="Dagupan Elementary School";   school_address="Dagupan City"; date_from="2004"; date_to="2010"; sort=0 }
  @{ application_id=$id; level="High School"; school_name="Dagupan National High School"; school_address="Dagupan City"; date_from="2010"; date_to="2014"; honors_awards="With Honors"; sort=1 }
  @{ application_id=$id; level="College";     school_name="University of Pangasinan";     school_address="Dagupan City"; date_from="2014"; date_to="2018"; degree_units_earned="BS Industrial Technology"; sort=2 }
) | Out-Null

Post "/items/application_work_experience" @(
  @{ application_id=$id; employer="ABC Logistics Inc."; address="Calasiao, Pangasinan"; job_title="Warehouse Staff"; date_from="2018-06"; date_to="2021-12"; salary_rate_start=13000; salary_rate_end=16000; supervisor_name="Mr. Reyes"; supervisor_contact="09181112222"; responsibilities="Receiving, put-away, cycle counts"; reason_for_leaving="Career growth"; sort=0 }
  @{ application_id=$id; employer="XYZ Trading";        address="Dagupan City";          job_title="Inventory Clerk";  date_from="2022-01"; date_to="2025-08"; salary_rate_start=17000; salary_rate_end=19000; supervisor_name="Ms. Cruz";  supervisor_contact="09193334444"; responsibilities="Stock reconciliation, reporting"; reason_for_leaving="Downsizing"; sort=1 }
) | Out-Null

Post "/items/application_reference" @(
  @{ application_id=$id; name="Engr. Robert Lim"; title_occupation="Operations Manager"; company_name_address="ABC Logistics Inc., Calasiao"; contact_number="09201234567"; sort=0 }
  @{ application_id=$id; name="Ms. Grace Tan";    title_occupation="HR Officer";         company_name_address="XYZ Trading, Dagupan";        contact_number="09209876543"; sort=1 }
) | Out-Null

Post "/items/application_training" @(
  @{ application_id=$id; title_subject="Forklift Safety & Operation";              venue_location="TESDA Pangasinan"; date_from="2019-03-01"; date_to="2019-03-05"; sort=0 }
  @{ application_id=$id; title_subject="Basic Occupational Safety and Health";     venue_location="DOLE Region 1";    date_from="2020-08-10"; date_to="2020-08-12"; sort=1 }
) | Out-Null

Post "/items/application_licensure_exam" @(
  @{ application_id=$id; examination="Forklift NC II"; date_taken="2019-03-06"; rating="Competent"; result="Passed"; inclusive_dates="2019"; sort=0 }
) | Out-Null

Post "/items/application_attachment" @(
  @{ application_id=$id; type="Resume"; label="Juan Dela Cruz - Resume.pdf"; uploaded_at=$now; sort=0 }
) | Out-Null

# 4. readback ---------------------------------------------------------
Write-Host "`n--- readback (rows per child table for application $id) ---"
foreach ($t in @("application_family_member","application_company_relative","application_education",
                 "application_work_experience","application_reference","application_training",
                 "application_licensure_exam","application_attachment")) {
    $r = Invoke-RestMethod -Method Get -Uri "$base/items/$t`?filter[application_id][_eq]=$id&aggregate[count]=*" -Headers $h
    Write-Host ("  {0,-34} {1} row(s)" -f $t, $r.data[0].count) -ForegroundColor Green
}
Write-Host "`nOpen Directus > Content > Application > id $id to walk the senior through it." -ForegroundColor Cyan
Write-Host "Remove later (children cascade):"
Write-Host "  Invoke-RestMethod -Method Delete -Uri `"$base/items/application/$id`" -Headers `$h" -ForegroundColor DarkGray
Write-Host "  Invoke-RestMethod -Method Delete -Uri `"$base/items/applicant/$applicantId`" -Headers `$h" -ForegroundColor DarkGray
