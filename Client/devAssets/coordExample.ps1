# Path to the input image
$imagePath = "/Users/billymiller/Desktop/originalImage.jpg"

# Path to save the output image
$outputPath = "/Users/billymiller/Desktop/drawnImage.jpg"

# Define the bounding box coordinates as JSON strings from the CSV export
$boundingBoxes = @(
    '[{"x":1065.3347,"y":1887.9732},{"x":1065.3347,"y":2002.0364},{"x":1339.2953,"y":1887.9732},{"x":1339.2953,"y":2002.0364}]',
    '[{"x":916.8747,"y":2469.2346},{"x":916.8747,"y":2574.353},{"x":1085.0607,"y":2469.2346},{"x":1085.0607,"y":2574.353}]',
    '[{"x":1736.5701,"y":1710.1252},{"x":1736.5701,"y":2038.4366},{"x":2435.9599,"y":1710.1252},{"x":2435.9599,"y":2038.4366}]'
)

# Define the opacity for the boxes (25% opacity)
$opacity = 0.25

# Define colors for each bounding box
$colors = @("rgba(0,255,0,$opacity)", "rgba(255,0,0,$opacity)", "rgba(0,0,255,$opacity)")

# Initialize the draw command
$drawCommands = @()

# Parse each bounding box and create the corresponding draw command
for ($i = 0; $i -lt $boundingBoxes.Count; $i++) {
    $boxJson = $boundingBoxes[$i]

    if (-not [string]::IsNullOrWhiteSpace($boxJson)) {
        $box = $boxJson | ConvertFrom-Json
        $topLeft = $box[0]
        $bottomLeft = $box[1]
        $topRight = $box[2]
        $bottomRight = $box[3]

        # Create the draw command for the current box with its specific color
        $drawCommands += "-fill ""$($colors[$i])"" -draw ""polygon $($topLeft.x),$($topLeft.y) $($bottomLeft.x),$($bottomLeft.y) $($bottomRight.x),$($bottomRight.y) $($topRight.x),$($topRight.y)"""
    }
}

# Combine all draw commands
$combinedDrawCommand = $drawCommands -join " "

# Use ImageMagick to add the colored boxes
$command = "magick `"$imagePath`" $combinedDrawCommand `"$outputPath`""

# Run the command
Invoke-Expression $command

Write-Host "Image saved to: $outputPath"