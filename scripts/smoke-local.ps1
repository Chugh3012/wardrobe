# Local end-to-end smoke test against the real backend (passwordless Azure).
# Exercises the full write path: SAS -> upload -> create -> predict -> confirm -> history -> delete.
$ErrorActionPreference = "Stop"
$base = "http://localhost:7071"
$h = @{ "x-ms-client-principal-id" = "local-dev-user"; "Content-Type" = "application/json" }

Write-Host "== 1. Request upload SAS ==" -ForegroundColor Cyan
$body = @{ blobName = "garments/e2e-test.jpg"; contentType = "image/jpeg" } | ConvertTo-Json
$sas = Invoke-RestMethod -Uri "$base/api/images/sas-url" -Method Post -Headers $h -Body $body
Write-Host "  blobName=$($sas.blobName)"

Write-Host "== 2. PUT-upload a real JPEG to blob ==" -ForegroundColor Cyan
$jpeg = [byte[]](0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00,0xFF,0xD9)
$up = Invoke-WebRequest -Uri $sas.uploadUrl -Method Put -Headers @{ "x-ms-blob-type" = "BlockBlob"; "Content-Type" = "image/jpeg" } -Body $jpeg
Write-Host "  upload status=$($up.StatusCode)"

Write-Host "== 3. Create garment ==" -ForegroundColor Cyan
$gbody = @{ name = "E2E Test Shirt"; category = "top"; catalogImageUrls = @($sas.readUrl) } | ConvertTo-Json
$g = Invoke-RestMethod -Uri "$base/api/garments" -Method Post -Headers $h -Body $gbody
Write-Host "  created id=$($g.id) name=$($g.name) wearCount=$($g.wearCount)"

Write-Host "== 4. Predict outfit ==" -ForegroundColor Cyan
$pbody = @{ outfitImageUrl = $sas.readUrl } | ConvertTo-Json
$pred = Invoke-RestMethod -Uri "$base/api/wear/predict" -Method Post -Headers $h -Body $pbody
Write-Host "  predictionAuditId=$($pred.predictionAuditId) source=$($pred.source) confidence=$($pred.confidenceLevel) count=$($pred.predictions.Count)"

Write-Host "== 5. Confirm wear ==" -ForegroundColor Cyan
$cbody = @{ predictionAuditId = $pred.predictionAuditId; confirmedGarmentId = $g.id; confirmed = $true } | ConvertTo-Json
$conf = Invoke-RestMethod -Uri "$base/api/wear/confirm" -Method Post -Headers $h -Body $cbody
Write-Host "  wearEventId=$($conf.id) garmentId=$($conf.garmentId)"

Write-Host "== 6. Patch garment (rename) ==" -ForegroundColor Cyan
$patchBody = @{ name = "E2E Renamed Shirt" } | ConvertTo-Json
$patched = Invoke-RestMethod -Uri "$base/api/garments/$($g.id)" -Method Patch -Headers $h -Body $patchBody
Write-Host "  renamed to=$($patched.name)"

Write-Host "== 7. Wear history ==" -ForegroundColor Cyan
$hist = Invoke-RestMethod -Uri "$base/api/wear/history" -Method Get -Headers $h
Write-Host "  history events=$($hist.events.Count)"

Write-Host "== 8. Stats summary ==" -ForegroundColor Cyan
$stats = Invoke-RestMethod -Uri "$base/api/stats/summary" -Method Get -Headers $h
Write-Host "  totalGarments=$($stats.totalGarments) totalWears=$($stats.totalWears)"

Write-Host "== 9. Delete wear event ==" -ForegroundColor Cyan
$delW = Invoke-WebRequest -Uri "$base/api/wear/events/$($conf.id)" -Method Delete -Headers $h
Write-Host "  delete wear status=$($delW.StatusCode)"

Write-Host "== 10. Delete garment ==" -ForegroundColor Cyan
$delG = Invoke-WebRequest -Uri "$base/api/garments/$($g.id)" -Method Delete -Headers $h
Write-Host "  delete garment status=$($delG.StatusCode)"

Write-Host "ALL STEPS PASSED" -ForegroundColor Green
