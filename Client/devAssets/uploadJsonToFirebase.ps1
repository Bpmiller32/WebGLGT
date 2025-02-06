# ========================
# CONFIGURATION VARIABLES
# ========================
$projectId  = "rafgroundtruth"     
$jsonFolder = "/Users/billymiller/Desktop/iom-actualtestdeck-BACKUP"   # Folder containing your JSON files

# Use your static access token here.
$accessToken = "ya29.a0AXeO80TrmZvRh_kRDDTelvKKlBRar3HN-maBSzuV6hjwnst2t26NhhzHlWgjSbJK6B9l0wMjo8W2tfHcG6kWJvBXLqEMdElDissWHT5WBiDWCgJMzCH5HtswQRl7aCqzDmTs7elHMEpeOlajeSTTGn28LA6Nip6GbmU_PzXHEV2uvT0_ZHVuAYmhZRE6PlCfkPPu7WC2356BRQwEC2EcQVNgPfJ3VCNbIvZ_TmItKBLgGekuTUCe8lNpjHlo-SdWv0G7sLFGdHDmlajlhki00TwEoT_A7FRI1nF3xLV5Rjjiy69xl07FHvipR4Y_hoRn74mHGW16wIX95bSsCFUD0etulXkZjrzxB9v22Tx6kKO5d0wp7E-LrErv_Rt0ZwLhvRl7pUv5_-BDMRm67Vy51FOR_NJsyJMYEnwaCgYKAdcSARESFQHGX2MifwUAfe4kz3MzNrUHCoqTrQ0426"

# ====================================
# Helper Function: Convert a value to Firestore format
# ====================================
function ConvertTo-FirestoreValue {
    param(
        [Parameter(Mandatory = $true)]
        $value
    )
    
    if ($null -eq $value) {
        return @{ nullValue = $null }
    }
    elseif ($value -is [string]) {
        return @{ stringValue = $value }
    }
    elseif ($value -is [int]) {
        return @{ integerValue = $value }
    }
    elseif ($value -is [double]) {
        return @{ doubleValue = $value }
    }
    elseif ($value -is [bool]) {
        return @{ booleanValue = $value }
    }
    # Handle arrays (but not strings)
    elseif ($value -is [System.Collections.IEnumerable] -and -not ($value -is [string])) {
        $arrayItems = @()
        foreach ($item in $value) {
            $arrayItems += ConvertTo-FirestoreValue $item
        }
        return @{ arrayValue = @{ values = $arrayItems } }
    }
    # Handle objects / hashtables
    elseif ($value -is [PSCustomObject] -or $value -is [hashtable]) {
        $mapFields = @{}
        foreach ($prop in $value.PSObject.Properties) {
            $mapFields[$prop.Name] = ConvertTo-FirestoreValue $prop.Value
        }
        return @{ mapValue = @{ fields = $mapFields } }
    }
    else {
        # Fallback: convert to string
        return @{ stringValue = $value.ToString() }
    }
}

# ====================================
# Helper Function: Convert plain JSON to Firestore Document format
# ====================================
function ConvertTo-FirestoreDocument {
    param(
        [Parameter(Mandatory = $true)]
        $object
    )
    
    $fields = @{}
    foreach ($prop in $object.PSObject.Properties) {
        # Do not remove any fields from the JSON; all fields (including "project") are stored in the document.
        $fields[$prop.Name] = ConvertTo-FirestoreValue $prop.Value
    }
    return @{ fields = $fields }
}

# ====================================
# Main: Loop over JSON files and upload them
# ====================================
$jsonFiles = Get-ChildItem -Path $jsonFolder -Filter *.json

foreach ($file in $jsonFiles) {
    Write-Host "Processing file: $($file.FullName)"
    
    try {
        $jsonContent = Get-Content -Path $file.FullName -Raw | ConvertFrom-Json
    }
    catch {
        Write-Host "Error reading $($file.Name): $_"
        continue
    }
    
    # Use the "project" field as the target Firestore collection.
    $collection = $jsonContent.project
    if ([string]::IsNullOrEmpty($collection)) {
        Write-Host "Skipping file $($file.Name) because it does not have a 'project' field."
        continue
    }
    
    # Convert the JSON content to Firestore document format.
    $document = ConvertTo-FirestoreDocument $jsonContent

    # Build the URL so that the document is created inside the collection from the JSON "project" field.
    # Firestore will auto-generate the document ID.
    $url = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/$collection"
    
    $headers = @{
        "Authorization" = "Bearer $accessToken"
        "Content-Type"  = "application/json"
    }
    
    # Convert the document to JSON with sufficient depth.
    $body = $document | ConvertTo-Json -Depth 20

    try {
        $response = Invoke-RestMethod -Uri $url -Method POST -Headers $headers -Body $body
        Write-Host "Successfully uploaded document from $($file.Name) into collection '$collection'."
    }
    catch {
        Write-Host "Error uploading document from $($file.Name): $_"
    }
}