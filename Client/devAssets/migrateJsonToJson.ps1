param(
    [Parameter(Mandatory = $true, HelpMessage = "Enter the full path to the folder containing the JSON files.")]
    [string]$FolderPath
)

# Define a blank coordinates object with integer values.
$blankCoordinates = @{
    topleft = @{
        x = 0
        y = 0
    }
    width  = 0
    height = 0
}

# Process every JSON file in the folder.
Get-ChildItem -Path $FolderPath -Filter *.json | ForEach-Object {

    $file = $_.FullName
    Write-Output "Processing file: $file"

    # Read and convert the JSON file.
    $jsonText   = Get-Content -Raw -Path $file
    $jsonObject = $jsonText | ConvertFrom-Json

    # Remove the "imageType" property from the root if it exists.
    if ($jsonObject.PSObject.Properties.Name -contains "imageType") {
        $jsonObject.PSObject.Properties.Remove("imageType")
    }

    # Remove the "id" property from the root if it exists.
    if ($jsonObject.PSObject.Properties.Name -contains "id") {
        $jsonObject.PSObject.Properties.Remove("id")
    }

    # Process each selection group if present.
    if ($jsonObject.selectionGroups) {
        foreach ($groupKey in $jsonObject.selectionGroups.PSObject.Properties.Name) {
            $group = $jsonObject.selectionGroups.$groupKey

            # Determine the new coordinates object.
            # Check explicitly if coordinates is an array ([object[]]) with exactly 4 items.
            if ($group.coordinates -and ($group.coordinates -is [object[]]) -and $group.coordinates.Count -eq 4) {

                # Extract x and y values.
                $xs = @()
                $ys = @()
                foreach ($coord in $group.coordinates) {
                    $xs += $coord.x
                    $ys += $coord.y
                }

                # Calculate minimum and maximum values.
                $minX = ($xs | Measure-Object -Minimum).Minimum
                $minY = ($ys | Measure-Object -Minimum).Minimum
                $maxX = ($xs | Measure-Object -Maximum).Maximum
                $maxY = ($ys | Measure-Object -Maximum).Maximum

                # Build the new coordinates object with values rounded and cast to integer.
                $newCoordinates = @{
                    topleft = @{
                        x = [int]([Math]::Round($minX))
                        y = [int]([Math]::Round($minY))
                    }
                    width  = [int]([Math]::Round($maxX - $minX))
                    height = [int]([Math]::Round($maxY - $minY))
                }
            }
            else {
                # If the coordinates property is not an array of 4 items, use the blank coordinates.
                $newCoordinates = $blankCoordinates
            }

            # Remove the old coordinates property (if present) and add the new one.
            if ($group.PSObject.Properties['coordinates']) {
                $group.PSObject.Properties.Remove('coordinates')
            }
            $group | Add-Member -NotePropertyName "coordinates" -NotePropertyValue $newCoordinates -Force

            # Process each box in the group's boxes array (if any) to add a blank "coordinates" field.
            if ($group.boxes) {
                foreach ($box in $group.boxes) {
                    if ($box.PSObject.Properties['coordinates']) {
                        $box.PSObject.Properties.Remove('coordinates')
                    }
                    $box | Add-Member -NotePropertyName "coordinates" -NotePropertyValue $blankCoordinates -Force
                }
            }
        }
    }

    # Convert the updated object back to JSON (using a depth of 10 to cover nested objects).
    $newJson = $jsonObject | ConvertTo-Json -Depth 10

    # Overwrite the original file with the new JSON.
    Set-Content -Path $file -Value $newJson
}

Write-Output "Migration complete."