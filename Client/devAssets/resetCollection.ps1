# Firestore project and collection details
$projectId      = "rafgroundtruth"
$collectionName = "usps"
$firestoreApiUrl = "https://firestore.googleapis.com/v1/projects/$projectId/databases/(default)/documents/$collectionName"

# Use your static access token here.
$accessToken = "ya29.a0AXeO80TrmZvRh_kRDDTelvKKlBRar3HN-maBSzuV6hjwnst2t26NhhzHlWgjSbJK6B9l0wMjo8W2tfHcG6kWJvBXLqEMdElDissWHT5WBiDWCgJMzCH5HtswQRl7aCqzDmTs7elHMEpeOlajeSTTGn28LA6Nip6GbmU_PzXHEV2uvT0_ZHVuAYmhZRE6PlCfkPPu7WC2356BRQwEC2EcQVNgPfJ3VCNbIvZ_TmItKBLgGekuTUCe8lNpjHlo-SdWv0G7sLFGdHDmlajlhki00TwEoT_A7FRI1nF3xLV5Rjjiy69xl07FHvipR4Y_hoRn74mHGW16wIX95bSsCFUD0etulXkZjrzxB9v22Tx6kKO5d0wp7E-LrErv_Rt0ZwLhvRl7pUv5_-BDMRm67Vy51FOR_NJsyJMYEnwaCgYKAdcSARESFQHGX2MifwUAfe4kz3MzNrUHCoqTrQ0426"


# Fetch all documents in the collection
$response = Invoke-RestMethod -Uri $firestoreApiUrl -Headers @{
    "Authorization" = "Bearer $authToken"
} -Method GET

# Check if documents are returned
if ($null -eq $response.documents) {
    Write-Host "No documents found in the collection."
    exit
}

# Iterate through each document in the collection
foreach ($doc in $response.documents) {
    $documentName = $doc.name
    Write-Host "Processing document: $documentName"

    # Construct the URL for the document update with update masks for 'status' and 'assignedTo'
    $documentUrl = "https://firestore.googleapis.com/v1/$documentName?updateMask.fieldPaths=status&updateMask.fieldPaths=assignedTo"

    # Prepare the payload for a partial update
    $updatePayload = @{
        fields = @{
            status     = @{ stringValue = "unclaimed" }
            assignedTo = @{ stringValue = "" }
        }
    } | ConvertTo-Json -Depth 10 -Compress

    # Update the document using a PATCH request
    Invoke-RestMethod -Uri $documentUrl -Headers @{
        "Authorization" = "Bearer $authToken"
        "Content-Type"  = "application/json"
    } -Method PATCH -Body $updatePayload

    Write-Host "Updated document: $documentName"
}

Write-Host "All documents updated successfully."