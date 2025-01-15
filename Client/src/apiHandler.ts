import Emitter from "./webgl/utils/eventEmitter";
import Experience from "./webgl/experience";
import axios from "axios";

export default class ApiHander {
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

      // Make a POST request to the protected endpoint
      const response = await axios.post(
        `${apiUrl}/exportToJson`,
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
    directoryPath: string
  ) {
    try {
      // Retrieve the token from localStorage
      const token = this.getTokenOrThrow();

      // Make a POST request to the protected endpoint
      const response = await axios.post(
        `${apiUrl}/next`,
        { projectName, directoryPath },
        { headers: this.getAuthHeaders(token) }
      );

      // Extract the response data, imageBlob is Base64 string since the content type on the response was json
      const { imageName, imageBlob } = response.data;
      if (!imageBlob) {
        throw new Error("No valid imageBlob in response");
      }

      // Decode base64 string -> Blob + object URL
      const { blob, blobUrl } = this.decodeBase64Image(imageBlob);

      return {
        imageName: imageName,
        imageBlob: blobUrl,
        blob: blob,
      };
    } catch (error) {
      console.error(
        "Could not navigate to or download the next image: ",
        error
      );
      Emitter.emit("appError", "Error getting next image");
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
      const {
        imageName,
        imageBlob,
        groupText0,
        groupText1,
        groupText2,
        imageType,
      } = response.data;
      if (!imageBlob) {
        throw new Error("No valid imageBlob in response");
      }

      const { blob, blobUrl } = this.decodeBase64Image(imageBlob);

      return {
        imageName: imageName,
        imageBlob: blobUrl,
        blob: blob,
        groupTexts: {
          groupText0: groupText0 || "",
          groupText1: groupText1 || "",
          groupText2: groupText2 || "",
        },
        imageType: imageType || "mp",
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
    webglExperience: Experience
  ) {
    // Retrieve projectName and directoryPath from localStorage
    const { projectName, directoryPath } = this.getProjectInfoOrThrow();

    // Pull next viable image from project db
    const image = await ApiHander.next(apiUrl, projectName, directoryPath);
    if (!image) {
      Emitter.emit("appError", "No image retrieved from the server");
      return;
    }

    // Start image load into webgl scene as a texture
    webglExperience.resources.loadGtImageFromApi(image.imageBlob, image.blob);

    // Set image name in EditorDashboard if reference is found, setting with elementId to save complicated ref passing
    const imageNameLabel = document.getElementById("gtImageName");
    if (imageNameLabel) {
      imageNameLabel.innerText = image.imageName;
    }

    // Check if we're loading the same image again (indicates no more unclaimed images)
    if (webglExperience.input.previousDashboardImageName === image.imageName) {
      Emitter.emit(
        "appWarning",
        "No more unclaimed, loaded previously unfinished image"
      );
    }
    webglExperience.input.previousDashboardImageName = image.imageName;

    // Note: Not revoking URL here since we may need it for downloading later
  }

  // Handler for retrieving and loading the previous image in WebGL experience.
  public static async handlePrevImage(
    apiUrl: string,
    webglExperience: Experience
  ) {
    // Retrieve projectName and directoryPath from localStorage
    const { projectName, directoryPath } = this.getProjectInfoOrThrow();

    // Pull previous image from project db
    const image = await ApiHander.prev(apiUrl, projectName, directoryPath);
    if (!image) {
      Emitter.emit(
        "appError",
        "No image retrieved from the server, previous image history might be empty"
      );
      return;
    }

    // Start image load into webgl scene as a texture
    webglExperience.resources.loadGtImageFromApi(
      image.imageBlob,
      image.blob,
      false
    );

    // Set image name in EditorDashboard if reference is found, setting with elementId to save complicated ref passing
    const imageNameLabel = document.getElementById("gtImageName");
    if (imageNameLabel) {
      imageNameLabel.innerText = image.imageName;
    }

    // Iterate over the textAreas to populate with previous groupTexts stored in db
    const textAreas = [
      "dashboardTextarea0",
      "dashboardTextarea1",
      "dashboardTextarea2",
    ];
    const groupTexts = [
      image.groupTexts.groupText0,
      image.groupTexts.groupText1,
      image.groupTexts.groupText2,
    ];
    textAreas.forEach((id, index) => {
      const textArea = document.getElementById(
        id
      ) as HTMLTextAreaElement | null;
      if (textArea) {
        textArea.value = groupTexts[index];
      }
    });

    // Check if we're loading the same image again
    if (webglExperience.input.previousDashboardImageName === image.imageName) {
      Emitter.emit("appWarning", "Previous image is the same as this image");
    }
    webglExperience.input.previousDashboardImageName = image.imageName;

    // Send back the rest of the image so that textClassification buttons can more simply be set back in EditorDashboard
    return image;

    // Note: Not revoking URL here since we need may it for downloading later
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
}
