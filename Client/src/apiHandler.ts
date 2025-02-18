import Emitter from "./webgl/utils/eventEmitter";
import Experience from "./webgl/experience";
import axios from "axios";

export default class ApiHandler {
  // Pings the Server
  public static async pingServer(apiUrl: string) {
    try {
      await axios.get(`${apiUrl}/pingServer`);
      return true;
    } catch (error) {
      console.error("Server not available:", error);
      Emitter.emit("appError", "Server not available");
      return false;
    }
  }

  // Retrieves Vision API key from Server
  public static async getApiKey(apiUrl: string) {
    try {
      const token = this.getTokenOrThrow();
      const response = await axios.get(`${apiUrl}/getApiKey`, {
        headers: this.getAuthHeaders(token),
      });

      return response.data;
    } catch (error) {
      console.error("Error getting apiKey: ", error);
      Emitter.emit("appError", "Error getting apiKey");
      return "";
    }
  }

  // Fetches available projects from Server
  public static async getProjects(apiUrl: string) {
    try {
      const response = await axios.get(`${apiUrl}/projectsInfo`);
      return response.data;
    } catch (error) {
      console.error("Error fetching projects:", error);
      Emitter.emit("appError", "Error fetching projects");
      return [];
    }
  }

  // Retrieves all images and their statuses for a project
  public static async getProjectImages(apiUrl: string, projectName: string) {
    try {
      // Retrieve the token from localStorage
      const token = this.getTokenOrThrow();

      // Make a POST request to the protected endpoint
      const response = await axios.post(
        `${apiUrl}/getProjectImages`,
        { projectName },
        { headers: this.getAuthHeaders(token) }
      );

      // Check for success in response
      if (response.status === 200) {
        return response.data;
      } else {
        return [];
      }
    } catch (error) {
      console.error("Error getting project images:", error);
      Emitter.emit("appError", "Error getting project images");
      return [];
    }
  }

  // Downloads User Guide PDF from the server and opens it in a new tab
  public static async getPdf(apiUrl: string) {
    try {
      const response = await axios.get(`${apiUrl}/getPdf`, {
        responseType: "blob", // Ensures the response is handled as a binary file
      });

      // Create a Blob object for the PDF
      const pdfBlob = new Blob([response.data], { type: "application/pdf" });

      // Create a URL for the Blob
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Open the PDF in a new tab
      window.open(pdfUrl, "_blank");

      // Revoke the object URL after some time, 10s seems like enough time to turn off popup blocker right?
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 10000);

      Emitter.emit("appSuccess", "Helpfile popup opened");
    } catch (error) {
      console.error("Error downloading the PDF: ", error);
      Emitter.emit("appError", "Error downloading the PDF");
    }
  }

  // Attempts login, stores JWT and project info in localstorage
  public static async login(
    apiUrl: string,
    username: string,
    password: string,
    autoLogin: boolean,
    projectName?: string,
    directoryPath?: string
  ) {
    try {
      const response = await axios.post(`${apiUrl}/login`, {
        username,
        password,
      });

      // Extract the token from the response
      const { token } = response.data;

      // Store the token securely in localStorage
      localStorage.setItem("jwtToken", token);

      // Set based on option in ProjectSelect. Note: projectName and directoryPath must be the same, directoryPath folder must exist in IMAGES_PATH env variable in Server
      if (projectName && directoryPath) {
        localStorage.setItem("projectName", projectName);
        localStorage.setItem("directoryPath", directoryPath);
      }

      if (autoLogin) {
        localStorage.setItem("autoLogin", "true");
      }

      return true;
    } catch (error) {
      console.error("Login failed: incorrect username or password: ", error);
      return false;
    }
  }

  // Creates a new image database (Firestore collection) for a project.
  public static async createImageDatabase(apiUrl: string, projectName: string) {
    try {
      // Retrieve the token from localStorage
      const token = this.getTokenOrThrow();

      // Make a POST request to the protected endpoint
      const response = await axios.post(
        `${apiUrl}/createImageDatabase`,
        { projectName },
        { headers: this.getAuthHeaders(token) }
      );

      // Check for success in response
      if (response.status == 200) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Error creating a new project:", error);
      return false;
    }
  }

  // Exports the specified project to CSV.
  public static async exportToCsv(apiUrl: string, projectName: string) {
    try {
      // Retrieve the token from localStorage
      const token = this.getTokenOrThrow();

      // Make a POST request to the protected endpoint
      const response = await axios.post(
        `${apiUrl}/exportToCsv`,
        { projectName },
        { headers: this.getAuthHeaders(token) }
      );

      // Check for success in response
      if (response.status == 200) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Error exporting project:", error);
      return false;
    }
  }

  // Exports the specified project to JSON as individual files.
  public static async exportToJson(apiUrl: string, projectName: string) {
    try {
      // Retrieve the token from localStorage
      const token = this.getTokenOrThrow();

      // Make a POST request to the protected endpoint with response type set to "blob" to expect a binary file (zip) in the response
      const response = await axios.post(
        `${apiUrl}/exportToJson`,
        { projectName },
        {
          headers: this.getAuthHeaders(token),
          responseType: "blob",
        }
      );

      // Check if the response is successful
      if (response.status === 200) {
        // Create a blob from the response data
        const blob = new Blob([response.data], { type: "application/zip" });

        // Create a URL for the blob
        const downloadUrl = URL.createObjectURL(blob);

        // Create an anchor element and trigger a download
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `${projectName}.zip`;
        document.body.appendChild(a);
        a.click();

        // Clean up the URL and remove the anchor element
        URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);

        return true;
      } else {
        console.error(
          "Failed to export project. Server returned non-200 status."
        );
        return false;
      }
    } catch (error) {
      console.error("Error exporting project:", error);
      return false;
    }
  }

  // Retrieves computed project statistics
  public static async getProjectStats(apiUrl: string, projectName: string) {
    try {
      // Retrieve the token from localStorage
      const token = this.getTokenOrThrow();

      // Make a POST request to the protected endpoint
      const response = await axios.post(
        `${apiUrl}/getProjectStats`,
        { projectName },
        { headers: this.getAuthHeaders(token) }
      );

      // Check for success in response
      if (response.status == 200) {
        return response.data;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error getting stats:", error);
      return null;
    }
  }

  // Checks if the stored token is valid by hitting a protected endpoint.
  public static async isTokenValid(apiUrl: string) {
    try {
      // Retrieve the token from localStorage
      const token = this.getTokenOrThrow();

      // If the token is expired this endpoint will throw an error
      await axios.get(`${apiUrl}/protected`, {
        headers: this.getAuthHeaders(token),
      });

      return true;
    } catch (error) {
      console.error("User token not found or valid: ", error);
      return false;
    }
  }

  // Requests the server for the "next" image to work on.
  public static async next(
    apiUrl: string,
    projectName: string,
    directoryPath: string,
    skipCurrent: boolean = false // NEW optional parameter to indicate skipping the current image
  ) {
    try {
      // Retrieve the token from localStorage.
      const token = this.getTokenOrThrow();

      // Make a POST request to the protected endpoint, including skipCurrent in the body.
      const response = await axios.post(
        `${apiUrl}/next`,
        { projectName, directoryPath, skipCurrent },
        { headers: this.getAuthHeaders(token) }
      );

      // Extract the response data. Note that imageBlob is a Base64 string.
      const { imageName, imageBlob } = response.data;
      if (!imageBlob) {
        throw new Error("No valid imageBlob in response");
      }

      // Decode the Base64 string into a Blob and an object URL.
      const { blob, blobUrl } = this.decodeBase64Image(imageBlob);

      return {
        imageName: imageName,
        imageBlob: blobUrl,
        blob: blob,
      };
    } catch (error: any) {
      console.error(
        "Could not navigate to or download the next image: ",
        error
      );
      
      // Check for specific 404 "No available entries" error
      if (error.response?.status === 404 && error.response?.data?.message === "No available entries") {
        // Use setTimeout to show the warning after any loading states are cleared
        setTimeout(() => {
          Emitter.emit("appWarning", "No available image candidates, likely at end of project deck");
        }, 500);
      } else {
        Emitter.emit("appError", "Error getting next image");
      }
      return null;
    }
  }

  // Requests the server for a specific image by name
  public static async getImageByName(
    apiUrl: string,
    projectName: string,
    directoryPath: string,
    imageName: string
  ) {
    try {
      // Retrieve the token from localStorage
      const token = this.getTokenOrThrow();

      // Make a POST request to the protected endpoint
      const response = await axios.post(
        `${apiUrl}/getByName`,
        { projectName, directoryPath, imageName },
        { headers: this.getAuthHeaders(token) }
      );

      // Extract the response data, imageBlob is Base64 string since the content type on the response was json
      const { imageBlob, selectionGroups, rotation } = response.data;
      if (!imageBlob) {
        throw new Error("No valid imageBlob in response");
      }

      const { blob, blobUrl } = this.decodeBase64Image(imageBlob);

      return {
        imageName: imageName,
        imageBlob: blobUrl,
        blob: blob,
        selectionGroups: {
          group0: {
            coordinates: selectionGroups.group0.coordinates || [],
            boxes: selectionGroups.group0.boxes || [],
            text: selectionGroups.group0.text || "",
            type: selectionGroups.group0.type || "",
          },
          group1: {
            coordinates: selectionGroups.group1.coordinates || [],
            boxes: selectionGroups.group1.boxes || [],
            text: selectionGroups.group1.text || "",
            type: selectionGroups.group1.type || "",
          },
          group2: {
            coordinates: selectionGroups.group2.coordinates || [],
            boxes: selectionGroups.group2.boxes || [],
            text: selectionGroups.group2.text || "",
            type: selectionGroups.group2.type || "",
          },
        },
        rotation: rotation || 0,
      };
    } catch (error) {
      console.error("Could not retrieve the specified image: ", error);
      Emitter.emit("appError", "Error getting image by name");
      return null;
    }
  }

  // Requests the server for the "previous" image in the user's history.
  public static async prev(
    apiUrl: string,
    projectName: string,
    directoryPath: string
  ) {
    try {
      // Retrieve the token from localStorage
      const token = this.getTokenOrThrow();

      // Make a POST request to the protected endpoint
      const response = await axios.post(
        `${apiUrl}/prev`,
        { projectName, directoryPath },
        { headers: this.getAuthHeaders(token) }
      );

      // Extract the response data, imageBlob is Base64 string since the content type on the response was json
      const { imageName, imageBlob, selectionGroups, rotation } = response.data;
      if (!imageBlob) {
        throw new Error("No valid imageBlob in response");
      }

      const { blob, blobUrl } = this.decodeBase64Image(imageBlob);

      return {
        imageName: imageName,
        imageBlob: blobUrl,
        blob: blob,
        selectionGroups: {
          group0: {
            coordinates: selectionGroups.group0.coordinates || [],
            boxes: selectionGroups.group0.boxes || [],
            text: selectionGroups.group0.text || "",
            type: selectionGroups.group0.type || "",
          },
          group1: {
            coordinates: selectionGroups.group1.coordinates || [],
            boxes: selectionGroups.group1.boxes || [],
            text: selectionGroups.group1.text || "",
            type: selectionGroups.group1.type || "",
          },
          group2: {
            coordinates: selectionGroups.group2.coordinates || [],
            boxes: selectionGroups.group2.boxes || [],
            text: selectionGroups.group2.text || "",
            type: selectionGroups.group2.type || "",
          },
        },
        rotation: rotation || 0,
      };
    } catch (error) {
      console.error(
        "Could not navigate to or download the previous image: ",
        error
      );
      Emitter.emit("appError", "Error getting prev image");
      return null;
    }
  }

  // Handler for retrieving and loading the next image in WebGL experience.
  public static async handleNextImage(
    apiUrl: string,
    webglExperience: Experience,
    skipCurrent: boolean = false // NEW optional parameter: true if the user wants to skip their current image
  ) {
    // Retrieve projectName and directoryPath from localStorage
    const { projectName, directoryPath } = this.getProjectInfoOrThrow();

    // Pull the next viable image from the project db, passing the skipCurrent flag.
    const image = await ApiHandler.next(
      apiUrl,
      projectName,
      directoryPath,
      skipCurrent
    );
    if (!image) {
      // Emit loadedFromApi to clear loading state even when there's no image
      Emitter.emit("loadedFromApi", { resetGui: true });
      return;
    }

    // Start image load into the WebGL scene as a texture.
    webglExperience.resources.loadGtImageFromApi(image.imageBlob, image.blob);

    // Set the image name in the EditorDashboard if the reference is found.
    const imageNameLabel = document.getElementById("gtImageName");
    if (imageNameLabel) {
      imageNameLabel.innerText = image.imageName;
    }

    // Check if we're loading the same image again (indicating no new unclaimed images)
    if (webglExperience.input.previousDashboardImageName === image.imageName) {
      Emitter.emit(
        "appWarning",
        "No more unclaimed, loaded previously unfinished image"
      );
    }
    webglExperience.input.previousDashboardImageName = image.imageName;

    // Reset classification tags for the selection groups.
    [0, 1, 2].forEach((groupId) => {
      Emitter.emit("setGroupType", { groupId, type: "" });
    });

    // Note: We’re not revoking the URL here since we may need it for downloading later.
  }

  // Handler for retrieving and loading a specific image by name in WebGL experience
  public static async handleImageByName(
    apiUrl: string,
    webglExperience: Experience,
    imageName: string
  ) {
    // Retrieve projectName and directoryPath from localStorage
    const { projectName, directoryPath } = this.getProjectInfoOrThrow();

    // Pull image from project db by name
    const image = await ApiHandler.getImageByName(
      apiUrl,
      projectName,
      directoryPath,
      imageName
    );
    if (!image) {
      Emitter.emit("appError", "Could not find image with the specified name");
      return;
    }

    // Set up event listener for image load completion
    const handleImageLoaded = this.setupImageLoadedHandler(
      image,
      webglExperience
    );
    Emitter.on("loadedFromApi", handleImageLoaded);

    // Load the image into the WebGL scene
    webglExperience.resources.loadGtImageFromApi(
      image.imageBlob,
      image.blob,
      false,
      image.rotation
    );

    // Update the UI with the db info
    this.updateDashboard(image.imageName, image.selectionGroups);

    // Step 7: Check for duplicate image load
    this.checkForDuplicateImage(image.imageName, webglExperience);
  }

  // Handler for retrieving and loading the previous image in WebGL experience.
  public static async handlePrevImage(
    apiUrl: string,
    webglExperience: Experience
  ) {
    // Retrieve projectName and directoryPath from localStorage
    const { projectName, directoryPath } = this.getProjectInfoOrThrow();

    // Pull previous image from project db
    const image = await ApiHandler.prev(apiUrl, projectName, directoryPath);
    if (!image) {
      Emitter.emit(
        "appError",
        "No image retrieved from the server, previous image history might be empty"
      );
      return;
    }

    // Set up event listener for image load completion
    const handleImageLoaded = this.setupImageLoadedHandler(
      image,
      webglExperience
    );
    Emitter.on("loadedFromApi", handleImageLoaded);

    // Load the image into the WebGL scene
    webglExperience.resources.loadGtImageFromApi(
      image.imageBlob,
      image.blob,
      false,
      image.rotation
    );

    // Update the UI with the db info
    this.updateDashboard(image.imageName, image.selectionGroups);

    // Step 7: Check for duplicate image load
    this.checkForDuplicateImage(image.imageName, webglExperience);

    // Note: Not revoking URL here since we need it for downloading later
  }

  // Sends updated image data to the server (Firestore).
  public static async updateImageData(apiUrl: string, updateData: any) {
    try {
      // Retrieve the token from localStorage
      const token = this.getTokenOrThrow();

      const projectName = localStorage.getItem("projectName");
      if (!projectName) {
        throw new Error("Project name not found in localStorage");
      }

      const response = await axios.post(
        `${apiUrl}/update`,
        { projectName, updateData },
        { headers: this.getAuthHeaders(token) }
      );

      if (!response.data) {
        Emitter.emit("appError", "Failed to confirm GT data was saved");
      }
    } catch (error) {
      console.error("Error updating image data: ", error);
      Emitter.emit("appError", "Error saving GT data");
    }
  }

  // Sends a base64-encoded image to Google Vision API.
  public static async sendToVisionAPI(apiKey: string, base64Image: string) {
    try {
      const requestBody = {
        requests: [
          {
            image: { content: base64Image },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          },
        ],
      };

      const response = await axios.post(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        requestBody,
        { headers: { "Content-Type": "application/json" } }
      );

      // Check if result has responses to use, response could come back empty
      const annotations =
        response.data?.responses?.[0]?.fullTextAnnotation?.text;
      if (!annotations) {
        console.error("Response from Vision is empty");
        Emitter.emit("appWarning", "Vision response is empty");
        return null;
      }

      return annotations;
    } catch (error) {
      console.error("Error sending image to Vision API: ", error);
      Emitter.emit("appWarning", "Error sending image to Vision API");
      return null;
    }
  }
  /* ----------------------------- Helper methods ----------------------------- */
  // Retrieves the JWT token from localStorage or throws an error if missing.
  private static getTokenOrThrow() {
    const token = localStorage.getItem("jwtToken");
    if (!token) {
      throw new Error("No user token found. Please log in.");
    }
    return token;
  }

  // Builds the authorization headers for Axios requests.
  private static getAuthHeaders(token: string) {
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  //  Decodes a base64-encoded image string into a Blob and object URL.
  private static decodeBase64Image(imageBlob: string) {
    // Strip the prefix (e.g., "data:image/png;base64,") if present
    const base64 = imageBlob.includes(",")
      ? imageBlob.split(",")[1]
      : imageBlob;

    // Decode Base64 to binary
    const binary = atob(base64);

    // Convert binary to array for Blob constructor
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }

    // Create an actual Blob object
    const blob = new Blob([array], { type: "image/png" });

    // Create an object URL from the Blob
    const blobUrl = URL.createObjectURL(blob);

    return { blob, blobUrl };
  }

  // Retrieves projectName/directoryPath from localStorage or throws an error if missing.
  private static getProjectInfoOrThrow() {
    const projectName = localStorage.getItem("projectName");
    const directoryPath = localStorage.getItem("directoryPath");
    if (!projectName || !directoryPath) {
      throw new Error("ProjectName or DirectoryPath missing. Please re-login.");
    }

    return { projectName, directoryPath };
  }

  // Sets up the event listener for handling the loaded image
  private static setupImageLoadedHandler(
    image: any,
    webglExperience: Experience
  ): (event: { resetGui: boolean; rotation?: number }) => void {
    const handler = (event: { resetGui: boolean; rotation?: number }) => {
      // Update rotation if provided
      if (event.rotation !== undefined) {
        const imageContainer = webglExperience.world.imageContainer;
        if (imageContainer?.mesh) {
          const rotationInRadians = event.rotation * (Math.PI / 180);
          imageContainer.targetRotation.y = rotationInRadians;
        }
      }

      // Recreate meshes for each selection group
      const selectionManager = webglExperience.world.selectionGroupManager;
      if (selectionManager && image.selectionGroups) {
        this.recreateSelectionMeshes(selectionManager, image.selectionGroups);
      }

      // Remove the event listener after it fires
      Emitter.off("loadedFromApi", handler);
    };
    return handler;
  }

  // Recreates meshes for the selection groups.
  private static recreateSelectionMeshes(
    selectionManager: any,
    selectionGroups: any
  ) {
    ["group0", "group1", "group2"].forEach((groupKey, index) => {
      const boxes = selectionGroups[groupKey]?.boxes || [];

      if (boxes.length > 0) {
        selectionManager.recreateMeshesFromData(index, boxes);
      }
    });
  }

  // Updates the image name in the UI.
  private static updateDashboard(imageName: string, selectionGroups: any) {
    // Update UI with image name
    const imageNameLabel = document.getElementById("gtImageName");
    if (imageNameLabel) {
      imageNameLabel.innerText = imageName;
    }

    // Populate text areas with group texts from the database
    const textAreas = [
      "dashboardTextarea0",
      "dashboardTextarea1",
      "dashboardTextarea2",
    ];
    const groupTexts = [
      selectionGroups.group0?.text || "",
      selectionGroups.group1?.text || "",
      selectionGroups.group2?.text || "",
    ];

    textAreas.forEach((id, index) => {
      const textArea = document.getElementById(
        id
      ) as HTMLTextAreaElement | null;
      if (textArea) {
        textArea.value = groupTexts[index];
      }
    });

    // Helper function to determine the correct group type
    const getGroupType = (type: string | undefined) => {
      const normalizedType = type?.toLowerCase();
      const typeMap = {
        mp: "MP",
        hw: "HW",
        bad: "Bad",
      } as const; // Ensures the values remain strictly typed

      return typeMap[normalizedType as keyof typeof typeMap] || "";
    };

    // Iterate through the selection groups and set classification tags
    [0, 1, 2].forEach((groupId) => {
      const type = selectionGroups[`group${groupId}`]?.type as string;
      Emitter.emit("setGroupType", { groupId, type: getGroupType(type) });
    });
  }

  // Checks if the loaded image is the same as the current image.
  private static checkForDuplicateImage(
    imageName: string,
    webglExperience: Experience
  ) {
    if (webglExperience.input.previousDashboardImageName === imageName) {
      Emitter.emit("appWarning", "Previous image is the same as this image");
    }
    webglExperience.input.previousDashboardImageName = imageName;
  }
}
