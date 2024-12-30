import Emitter from "./webgl/utils/eventEmitter";
import Experience from "./webgl/experience";
import axios from "axios";

export default class ApiHander {
  public static async pingServer(apiUrl: string) {
    try {
      await axios.get(apiUrl + "/pingServer");
      return true;
    } catch {
      console.error("Server not available");
      Emitter.emit("appError", "Server not available");
      return false;
    }
  }

  public static async getApiKey(apiUrl: string) {
    try {
      // Retrieve the token from localStorage
      const token = localStorage.getItem("jwtToken");
      if (!token) {
        throw new Error("No user token found. Please log in.");
      }

      const response = await axios.get(apiUrl + "/getApiKey", {
        headers: {
          Authorization: `Bearer ${token}`, // Include the token in the Authorization header
          "Content-Type": "application/json", // Ensure content type is JSON
        },
      });

      return response.data;
    } catch {
      console.error("Error getting apiKey");
      Emitter.emit("appError", "Error getting apiKey");
      return "";
    }
  }

  public static async getProjects(apiUrl: string) {
    try {
      const response = await axios.get(apiUrl + "/projectsInfo");

      return response.data;
    } catch (error) {
      console.error("Error fetching projects: ", error);
      Emitter.emit("appError", "Error fetching projects");
      return [];
    }
  }

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

      // Revoke the object URL after some time
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 1000);

      Emitter.emit("appSuccess", "Helpfile popup opened");
    } catch {
      console.error("Error downloading the PDF");
      Emitter.emit("appError", "Error downloading the PDF");
    }
  }

  public static async login(
    apiUrl: string,
    username: string,
    password: string,
    autoLogin: boolean,
    projectName?: string,
    directoryPath?: string
  ) {
    try {
      const response = await axios.post(apiUrl + "/login", {
        username: username,
        password: password,
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
    } catch {
      console.error("Login failed: incorrect username or password");
      return false;
    }
  }

  public static async createImageDatabase(apiUrl: string, projectName: string) {
    try {
      // Retrieve the token from localStorage
      const token = localStorage.getItem("jwtToken");
      if (!token) {
        throw new Error("No user token found. Please log in.");
      }

      // Make a POST request to the protected endpoint
      const response = await axios.post(
        apiUrl + "/createImageDatabase", // Endpoint
        { projectName }, // Request body
        {
          headers: {
            Authorization: `Bearer ${token}`, // Include the token in the Authorization header
            "Content-Type": "application/json", // Ensure content type is JSON
          },
        }
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

  public static async exportToCsv(apiUrl: string, projectName: string) {
    try {
      // Retrieve the token from localStorage
      const token = localStorage.getItem("jwtToken");
      if (!token) {
        throw new Error("No user token found. Please log in.");
      }

      // Make a POST request to the protected endpoint
      const response = await axios.post(
        apiUrl + "/exportToCsv", // Endpoint
        { projectName }, // Request body
        {
          headers: {
            Authorization: `Bearer ${token}`, // Include the token in the Authorization header
            "Content-Type": "application/json", // Ensure content type is JSON
          },
        }
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

  public static async getProjectStats(apiUrl: string, projectName: string) {
    try {
      // Retrieve the token from localStorage
      const token = localStorage.getItem("jwtToken");
      if (!token) {
        throw new Error("No user token found. Please log in.");
      }

      // Make a POST request to the protected endpoint
      const response = await axios.post(
        apiUrl + "/getProjectStats", // Endpoint
        { projectName }, // Request body
        {
          headers: {
            Authorization: `Bearer ${token}`, // Include the token in the Authorization header
            "Content-Type": "application/json", // Ensure content type is JSON
          },
        }
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

  public static async isTokenValid(apiUrl: string) {
    try {
      // Retrieve the token from localStorage
      const token = localStorage.getItem("jwtToken");
      if (!token) {
        throw new Error("No user token found. Please log in.");
      }

      // If the token is expired this endpoint will throw an error
      await axios.get(apiUrl + "/protected", {
        headers: {
          Authorization: `Bearer ${token}`, // Include the token in the Authorization header
          "Content-Type": "application/json", // Ensure content type is JSON
        },
      });

      return true;
    } catch {
      console.error("User token not found or valid");
      return false;
    }
  }

  public static async next(
    apiUrl: string,
    projectName: string,
    directoryPath: string
  ) {
    try {
      // Retrieve the token from localStorage
      const token = localStorage.getItem("jwtToken");
      if (!token) {
        throw new Error("No user token found. Please log in.");
      }

      // Make a POST request to the protected endpoint
      const response = await axios.post(
        apiUrl + "/next", // Endpoint
        { projectName, directoryPath }, // Request body
        {
          headers: {
            Authorization: `Bearer ${token}`, // Include the token in the Authorization header
            "Content-Type": "application/json", // Ensure content type is JSON
          },
        }
      );

      // Extract the response data, imageBlob is Base64 string since the content type on the response was json
      const { imageName, imageBlob } = response.data;

      // Decode Base64 to binary
      const binary = atob(imageBlob);
      // Convert binary to array for Blob constructor
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      // Create an actual Blob object
      const blob = new Blob([array], { type: "image/png" });

      // Create an object URL from the Blob
      const imageBlobUrl = URL.createObjectURL(blob);

      return {
        imageName: imageName,
        imageBlob: imageBlobUrl,
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

  public static async prev(
    apiUrl: string,
    projectName: string,
    directoryPath: string
  ) {
    try {
      // Retrieve the token from localStorage
      const token = localStorage.getItem("jwtToken");
      if (!token) {
        throw new Error("No user token found. Please log in.");
      }

      // Make a POST request to the protected endpoint
      const response = await axios.post(
        apiUrl + "/prev", // Endpoint
        { projectName, directoryPath }, // Request body
        {
          headers: {
            Authorization: `Bearer ${token}`, // Include the token in the Authorization header
            "Content-Type": "application/json", // Ensure content type is JSON
          },
        }
      );

      // Extract the response data, imageBlob is Base64 string since the content type on the response was json
      const { imageName, imageBlob } = response.data;

      // Decode Base64 to binary
      const binary = atob(imageBlob);
      // Convert binary to array for Blob constructor
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      // Create an actual Blob object
      const blob = new Blob([array], { type: "image/png" });

      // Create an object URL from the Blob
      const imageBlobUrl = URL.createObjectURL(blob);

      return {
        imageName: imageName,
        imageBlob: imageBlobUrl,
        blob: blob,
      };
    } catch {
      console.error("Could not navigate to or download the previous image");
      Emitter.emit("appError", "Error getting prev image");
      return null;
    }
  }

  public static async handleNextImage(
    apiUrl: string,
    webglExperience: Experience
  ) {
    // Retrieve projectName and directoryPath from localStorage
    const projectName = localStorage.getItem("projectName");
    const directoryPath = localStorage.getItem("directoryPath");
    if (!projectName || !directoryPath) {
      Emitter.emit(
        "appError",
        "ProjectName or DirectoryPath missing, re-login"
      );
      return;
    }

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
    const newImageName = image.imageName;
    if (webglExperience.input.previousDashboardImageName === newImageName) {
      Emitter.emit(
        "appWarning",
        "No more unclaimed, loaded previously unfinished image"
      );
    }
    webglExperience.input.previousDashboardImageName = newImageName;

    // Note: Not revoking URL here since we may need it for downloading later
  }

  public static async handlePrevImage(
    apiUrl: string,
    webglExperience: Experience
  ) {
    // Retrieve projectName and directoryPath from localStorage
    const projectName = localStorage.getItem("projectName");
    const directoryPath = localStorage.getItem("directoryPath");
    if (!projectName || !directoryPath) {
      Emitter.emit(
        "appError",
        "ProjectName or DirectoryPath missing, re-login"
      );
      return;
    }

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
    webglExperience.resources.loadGtImageFromApi(image.imageBlob, image.blob);

    // Set image name in EditorDashboard if reference is found, setting with elementId to save complicated ref passing
    const imageNameLabel = document.getElementById("gtImageName");
    if (imageNameLabel) {
      imageNameLabel.innerText = image.imageName;
    }

    // Check if we're loading the same image again
    const newImageName = image.imageName;
    if (webglExperience.input.previousDashboardImageName === newImageName) {
      Emitter.emit("appWarning", "Previous image is the same as this image");
    }
    webglExperience.input.previousDashboardImageName = newImageName;

    // Note: Not revoking URL here since we need may it for downloading later
  }

  public static async updateImageData(apiUrl: string, updateData: any) {
    try {
      // Retrieve the token from localStorage
      const token = localStorage.getItem("jwtToken");
      if (!token) {
        throw new Error("No user token found. Please log in");
      }

      const requestBody = {
        projectName: localStorage.getItem("projectName"),
        updateData,
      };

      const response = await axios.post(`${apiUrl}/update`, requestBody, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.data) {
        Emitter.emit("appError", "Failed to confirm GT data was saved");
        return;
      }
    } catch {
      console.error("Error updating image data");
      Emitter.emit("appError", "Error saving GT data");
      return;
    }
  }

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
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      // Check if result has responses to use, response could come back empty
      if (
        !response.data.responses ||
        !response.data.responses.length ||
        !response.data.responses[0].fullTextAnnotation
      ) {
        console.error("Response from Vision is empty");
        Emitter.emit("appWarning", "Vision response is empty");
        return null;
      }

      return response.data.responses[0].fullTextAnnotation.text;
    } catch {
      console.error("Error sending image to Vision API");
      Emitter.emit("appWarning", "Error sending image to Vision API");
      return null;
    }
  }
}
