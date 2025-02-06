[string]$ServiceAccountPath = "C:\Users\billy\Documents\WebGLGT\googleCloudServiceAccount.json"
[string]$ProjectId = "webglgt"
[string]$Collection = "demo-images"

# Load service account credentials and get an OAuth token
Write-Host "Authenticating with Google Cloud..."
$env:GOOGLE_APPLICATION_CREDENTIALS = $ServiceAccountPath
$authToken = & gcloud auth print-access-token

if (-not $authToken) {
    Write-Host "Failed to retrieve authentication token."
    exit 1
}

# Firestore API base URL
$firestoreBaseUrl = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/(default)/documents/$Collection"

# Get all documents in the collection
Write-Host "Fetching documents from Firestore..."
$headers = @{ "Authorization" = "Bearer $authToken" }

try {
    $response = Invoke-RestMethod -Uri $firestoreBaseUrl -Headers $headers -Method Get
} catch {
    Write-Host "❌ Error fetching documents: $($_.Exception.Message)"
    exit 1
}

if (-not $response.documents) {
    Write-Host "No documents found in collection: $Collection"
    exit 0
}

# Iterate through each document and update the 'status' field
foreach ($doc in $response.documents) {
    # Ensure document name exists
    if (-not $doc.name) {
        Write-Host "❌ Skipping document due to missing 'name' field."
        continue
    }

    # Extract the correct document path
    $documentPath = $doc.name -replace "^projects/$ProjectId/databases/\(default\)/documents/", ""

    # Debugging: Show extracted document path
    Write-Host "Extracted Document Path: '$documentPath'"

    # Ensure the document path is valid
    if (-not $documentPath -or $documentPath -eq "") {
        Write-Host "❌ Skipping update due to missing document path."
        continue
    }

    # Ensure the URL is properly constructed
    $updateUrl = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/(default)/documents/$documentPath"
    $queryParams = "?updateMask.fieldPaths=status"

    # Firestore update payload
    $updatePayload = @{
        fields = @{
            status = @{
                stringValue = "unclaimed"
            }
        }
    } | ConvertTo-Json -Depth 10 -Compress  # Ensures proper JSON format

    Write-Host "`nUpdating document: $documentPath"
    Write-Host "Request URL: $updateUrl$queryParams"
    Write-Host "Request Body: $updatePayload"

    try {
        $response = Invoke-RestMethod -Uri "$updateUrl$queryParams" -Headers $headers -Method PATCH -Body $updatePayload -ContentType "application/json; charset=UTF-8"
        Write-Host "✅ Successfully updated document: $documentPath"
    } catch {
        Write-Host "❌ Error updating document: $documentPath"
        Write-Host "Response: $($_.Exception.Response.StatusCode) - $($_.Exception.Message)"
        Write-Host "Detailed Response: $($_.ErrorDetails.Message)"
    }
}

Write-Host "All documents processed."