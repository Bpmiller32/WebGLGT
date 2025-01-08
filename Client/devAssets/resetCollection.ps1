# Path to your service account key file
$serviceAccountKeyPath = "$($HOME)/Desktop/googleCloudServiceAccount.json"

# Firestore project and collection details
$projectId = "rafgroundtruth"
$collectionName = "usps"
$firestoreApiUrl = "https://firestore.googleapis.com/v1/projects/$($projectId)/databases/(default)/documents/$($collectionName)"

# Function to parse and use PEM private key
function Get-RsaFromPem {
    param (
        [string]$pem
    )

    $pem = $pem -replace '-----BEGIN PRIVATE KEY-----', '' -replace '-----END PRIVATE KEY-----', '' -replace "`r`n", ""
    $keyBytes = [Convert]::FromBase64String($pem)
    
    $rsa = New-Object System.Security.Cryptography.RSACryptoServiceProvider
    $rsa.ImportPkcs8PrivateKey($keyBytes, [ref]0)
    return $rsa
}

# Function to create a JWT and obtain an access token
function Get-FirebaseAuthToken {
    param (
        [string]$KeyPath
    )
    
    # Read the service account key
    $key = Get-Content -Raw -Path $KeyPath | ConvertFrom-Json

    # Create a JWT header and claim set
    $jwtHeader = @{
        alg = "RS256"
        typ = "JWT"
    }
    $jwtClaimSet = @{
        iss   = $key.client_email
        scope = "https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore"
        aud   = "https://oauth2.googleapis.com/token"
        exp   = [System.Math]::Floor([double]((Get-Date).AddMinutes(60).ToUniversalTime() - (Get-Date "01/01/1970")).TotalSeconds)
        iat   = [System.Math]::Floor([double]((Get-Date).ToUniversalTime() - (Get-Date "01/01/1970")).TotalSeconds)
    }
    
    # Encode the JWT header and claim set
    $jwtHeaderEncoded    = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -Compress -InputObject $jwtHeader)))
    $jwtClaimSetEncoded  = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -Compress -InputObject $jwtClaimSet)))
    $jwtUnsigned         = "$jwtHeaderEncoded.$jwtClaimSetEncoded"
    
    # Sign the JWT with the private key
    $rsa = Get-RsaFromPem -pem $key.private_key
    $jwtSignature = [Convert]::ToBase64String($rsa.SignData([System.Text.Encoding]::UTF8.GetBytes($jwtUnsigned), 'SHA256'))

    # Combine the header, claim set, and signature
    $jwt = "$jwtUnsigned.$jwtSignature"
    
    # Request an access token
    $response = Invoke-RestMethod -Uri "https://oauth2.googleapis.com/token" -Method POST -Body @{
        grant_type = "urn:ietf:params:oauth:grant-type:jwt-bearer"
        assertion  = $jwt
    }
    
    return $response.access_token
}

# Obtain an access token
$authToken = Get-FirebaseAuthToken -KeyPath $serviceAccountKeyPath

# Fetch all documents in the collection
$response = Invoke-RestMethod -Uri $firestoreApiUrl -Headers @{
    "Authorization" = "Bearer $($authToken)"
} -Method GET

# Check if documents are returned
if ($null -eq $response.documents) {
    Write-Host "No documents found in the collection."
    exit
}

# Iterate through each document
foreach ($doc in $response.documents) {
    $documentName = $doc.name
    Write-Host "Processing document: $($documentName)"

    # Construct the full URL for the document
    $documentUrl = "https://firestore.googleapis.com/v1/$($documentName)?updateMask.fieldPaths=status&updateMask.fieldPaths=assignedTo"

    # Prepare the fields to update
    $updatePayload = @{
        fields = @{
            status = @{
                stringValue = "unclaimed"
            }
            assignedTo = @{
                stringValue = ""
            }
        }
    } | ConvertTo-Json -Depth 10 -Compress

    # Update the document (partial update)
    Invoke-RestMethod -Uri $documentUrl -Headers @{
        "Authorization" = "Bearer $($authToken)"
        "Content-Type"  = "application/json"
    } -Method PATCH -Body $updatePayload

    Write-Host "Updated document: $($documentName)"
}

Write-Host "All documents updated successfully."