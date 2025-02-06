# Set your Google Cloud Project ID.
$projectId = "rafgroundtruth"

# Firestore database identifier (usually "(default)").
$databaseId = "(default)"
$encodedDatabaseId = [System.Uri]::EscapeDataString($databaseId)

# Define the list of Firestore collection names you want to delete.
$collections = @("=3TqQyysqCEk6FK8R5Dda",
"=3eQ6qju39WOgkpAik8vR",
"=5IY6Z4yb9m9pFNaeX4ib",
"=5oHYWTXz7ccd1of4bVCN",
"=9P3nd9iPnuAKGTnwbVKt",
"=9caJdYVNu3s4h7SfhR7N",
"=DD4quEBj0h0R3C5ZLe2R",
"=ELl5gTIsECOXcoGZFZas",
"=EPiDp72J1617Gg3sW8oB",
"=EuomILl2K67iWYLxAldh",
"=FSafX7akcJ00iVJUuUh8",
"=FbYP5iYjd1bwnPAAE42l",
"=FuX5VsIwzpA2xXv0lXNI",
"=G4wqci5AVaM7ggb5A3Rb",
"=GNpdm7Ae56t4i8aHlVjO",
"=HJCwgHKf6Im3VGGXH34x",
"=IAIvzoF1VRlF94ftTOhW",
"=Il6Y73vlTLAQSBPbcP8A",
"=JsCIVblLSFiZtTRQov6W",
"=KQ6dV9yz1Emk7CxNQZND",
"=NP9K6DWpnMeq7ufhYno9",
"=NZXWJgBfB0Rg5McqXGGW",
"=QBhTikSleMS34bTIIYaU",
"=QeZsSVrKlosrrUd31edE",
"=ReqVNmcnMcHLlc3aJVrK",
"=SMoj7Rt8xipzZ4JtkXTr",
"=Su1PvWP5uKQUNgCrwb1j",
"=U46jUhorhZjQquZpR3DG",
"=VQORWwE2WeJqLNwR4uRs",
"=Yf8UF6cBQqoOf6ohJEwq",
"=YtYzjYkUVws2k7vjo7XL",
"=ZHwMDlzii5BRU6txU2F8",
"=a06dFfghQNq5vtGAIz6d",
"=ap3JWXF2ewueRQaTnzkr",
"=blyJ9K6UYme21pAHxWPZ",
"=dj81hhAfTQBZVKud6NY9",
"=fg3i83LljPUawt10D6o8",
"=gHuZaNtrqWSq7V5zWIuM",
"=hEISZ3AymNuB7mk2i1Y7",
"=ifMEBoKbv1dwtURi8ZAX",
"=levT5hq1RuiVbI0949zb",
"=oTBT4vJ82ycPbq3nLvmO",
"=qdcUeSwiU7qpSjvqtb15",
"=r1SKGR0sygXFkkZYxL49",
"=s9pdB4bHGJWZIHwMLKau",
"=sXnTMtwGYeOT2anYOx1u",
"=tKTM7Z14hfAE885Seykh",
"=tnMwo7O3Lmk6SVEi74f9",
"=u9y5CVUTjmmqjVo7anRJ",
"=uv9PcApNRMPvNnjeygM3")

# Base URL for Firestore REST API runQuery requests.
$runQueryUrl = "https://firestore.googleapis.com/v1/projects/$projectId/databases/$encodedDatabaseId/documents:runQuery"

# Use your static access token here.
$accessToken = "ya29.a0AXeO80TrmZvRh_kRDDTelvKKlBRar3HN-maBSzuV6hjwnst2t26NhhzHlWgjSbJK6B9l0wMjo8W2tfHcG6kWJvBXLqEMdElDissWHT5WBiDWCgJMzCH5HtswQRl7aCqzDmTs7elHMEpeOlajeSTTGn28LA6Nip6GbmU_PzXHEV2uvT0_ZHVuAYmhZRE6PlCfkPPu7WC2356BRQwEC2EcQVNgPfJ3VCNbIvZ_TmItKBLgGekuTUCe8lNpjHlo-SdWv0G7sLFGdHDmlajlhki00TwEoT_A7FRI1nF3xLV5Rjjiy69xl07FHvipR4Y_hoRn74mHGW16wIX95bSsCFUD0etulXkZjrzxB9v22Tx6kKO5d0wp7E-LrErv_Rt0ZwLhvRl7pUv5_-BDMRm67Vy51FOR_NJsyJMYEnwaCgYKAdcSARESFQHGX2MifwUAfe4kz3MzNrUHCoqTrQ0426"

# Function to list documents in a collection using the runQuery method.
function Get-DocumentsInCollection {
    param(
        [string]$collectionName,
        [string]$accessToken,
        [string]$runQueryUrl
    )

    $documents = @()

    # Build the structured query payload.
    $queryPayload = @{
        structuredQuery = @{
            from  = @(@{ collectionId = $collectionName })
            limit = 100
        }
    } | ConvertTo-Json -Depth 10

    try {
        $response = Invoke-RestMethod -Method Post -Uri $runQueryUrl `
            -Headers @{ 
                Authorization = "Bearer $accessToken"; 
                "Content-Type" = "application/json" 
            } -Body $queryPayload
    }
    catch {
        Write-Error "Error listing documents for collection '$collectionName': $_"
        return $documents
    }

    # The runQuery response returns an array of results.
    # Each item that has a "document" property represents a document.
    foreach ($item in $response) {
        if ($item.document) {
            $documents += $item.document
        }
    }

    return $documents
}

# Loop over each collection.
foreach ($collection in $collections) {
    Write-Host "Processing collection: $collection"

    # Get all documents in this collection.
    $docs = Get-DocumentsInCollection -collectionName $collection -accessToken $accessToken -runQueryUrl $runQueryUrl
    Write-Host "Found $($docs.Count) documents in collection '$collection'."

    foreach ($doc in $docs) {
        # Each document resource has a full name, e.g.:
        # "projects/<projectId>/databases/(default)/documents/collectionName/documentId"
        $docName = $doc.name
        Write-Host "Deleting document: $docName"

        # Build the DELETE URL for the document.
        $deleteUrl = "https://firestore.googleapis.com/v1/$docName"
        try {
            Invoke-RestMethod -Method Delete -Uri $deleteUrl -Headers @{ Authorization = "Bearer $accessToken" }
            Write-Host "Successfully deleted: $docName"
        }
        catch {
            # Write-Error "Failed to delete document $docName: $_"
        }
    }

    Write-Host "Finished processing collection: $collection`n"
}