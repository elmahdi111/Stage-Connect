$path = "c:\xampp\htdocs\sc\app.js"
$content = Get-Content $path -Raw

# Replace the problematic condition - remove the display check
$old = "if (offersEl && document.getElementById('admin-tab-offers-content').style.display !== 'none') {"
$new = "if (offersEl) {"
$content = $content -replace [regex]::Escape($old), $new

# Also add checked state to checkboxes
$oldCheck = "<input type=`"checkbox`" class=`"offer-checkbox`" data-offer-id=`"`${o.id}`" onchange=`"toggleOfferSelect(`${o.id})`" />"
$newCheck = "<input type=`"checkbox`" class=`"offer-checkbox`" data-offer-id=`"`${o.id}`" `${state.selectedOfferIds && state.selectedOfferIds.has(o.id) ? 'checked' : ''} onchange=`"toggleOfferSelect(`${o.id})`" />"
$content = $content -replace [regex]::Escape($oldCheck), $newCheck

# Also update select all checkbox state
$oldSelectAll = "<input type=`"checkbox`" onchange=`"toggleSelectAllOffers(this)`" />"
$newSelectAll = "<input type=`"checkbox`" `${internships && internships.length > 0 && internships.every(o => state.selectedOfferIds && state.selectedOfferIds.has(o.id)) ? 'checked' : ''} onchange=`"toggleSelectAllOffers(this)`" />"
$content = $content -replace [regex]::Escape($oldSelectAll), $newSelectAll

Set-Content $path $content
Write-Host "Fixed app.js"
