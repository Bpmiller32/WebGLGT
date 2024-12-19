<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import Experience from "./webgl/experience.ts";
import EditorDashboard from "./components/EditorDashboard.tsx";
import LoginPage from "./components/LoginPage.tsx";
import { getApiKey } from "./apiHandler.ts";
import StatusNotification from "./components/StatusNotification.tsx";
import Emitter from "./webgl/utils/eventEmitter.ts";
import axios from "axios";

/* -------------------------------- App setup ------------------------------- */
const webglRef = ref<HTMLCanvasElement | null>(null);
const isAppStarted = ref(false);

const apiUrl = import.meta.env.VITE_NGROK_URL;
const webglExperience = Experience.getInstance();

onMounted(() => {
  webglExperience.configure(webglRef.value);

  // Only after experience is initialized, fire event so that world entities are created
  Emitter.emit("appReady");
});

onUnmounted(() => {
  webglExperience.destroy();
  Emitter.all.clear();
});

/* --------------------------------- Events --------------------------------- */
Emitter.on("startApp", async () => {
  // Show statusNotification for loading in case of long browser initialize and login
  Emitter.emit("indicateLoading");

  // TODO: quick implement, redo with choices for old and new BE
  // // Initialize browser on the server
  // const serverInstanceInitialized = await startBrowserInstance(apiUrl);

  // if (!serverInstanceInitialized) {
  //   return;
  // }

  // Transition login page -> app page
  isAppStarted.value = !isAppStarted.value;

  // // Pull image from current page
  // const image = await downloadImage(apiUrl);

  const testNextImage = async (apiUrl: string) => {
    const token =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6ImJpbGx5bSIsImlhdCI6MTczNDU3NDc3NiwiZXhwIjoxNzM0NTc4Mzc2fQ.bK9vJ4TdmiBxAxRsHhNQKRR4vO7F-Z1b_zihe18kt7k";

    try {
      const response = await axios.get(apiUrl + "/next", {
        headers: {
          Authorization: `Bearer ${token}`, // Include JWT token in the Authorization header
        },
        responseType: "blob", // To handle binary image data
      });

      // const imageName = response.headers["x-gt-image-name"];
      // Create an object URL for the image Blob
      const imageUrl = URL.createObjectURL(response.data);

      return {
        // imageName: imageName,
        imageBlob: imageUrl,
      };
    } catch {
      console.error("Could not be download image from server");
      Emitter.emit("appError");
    }
  };

  const image = await testNextImage(apiUrl);

  if (!image) {
    return;
  }

  // Get Vision API key from backend
  webglExperience.resources.apiKey = await getApiKey(apiUrl);

  // Start image load into webgl scene as a texture, resourceLoader will trigger an event when finished loading
  webglExperience.resources.loadGtImageFromApi(image.imageBlob);

  // // Set the image's name in the gui
  // webglExperience.input.dashboardImageName!.innerText =
  //   image.imageName + ".jpg";

  // Clean up (string is very long since it is a blob of the entire image)
  URL.revokeObjectURL(image.imageBlob);
});
</script>

<template>
  <!-- Start/Login page -->
  <Transition
    leaveFromClass="opacity-100"
    leaveToClass="opacity-0"
    leaveActiveClass="duration-[500ms]"
  >
    <LoginPage v-if="!isAppStarted" id="loginPage" :apiUrl="apiUrl" />
  </Transition>

  <!-- Main app -->
  <Transition
    enterFromClass="opacity-0"
    enterToClass="opacity-100"
    enterActiveClass="duration-[2500ms]"
  >
    <main v-show="isAppStarted">
      <StatusNotification class="absolute top-0 left-1/2 -translate-x-1/2" />

      <EditorDashboard id="gui" class="absolute" :apiUrl="apiUrl" />

      <canvas ref="webglRef"></canvas>
    </main>
  </Transition>
</template>
