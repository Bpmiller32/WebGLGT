<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import Experience from "./webgl/experience.ts";
import EditorDashboard from "./components/EditorDashboard.tsx";
import LoginPage from "./components/LoginPage.tsx";
import ApiHandler from "./apiHandler.ts";
import StatusNotification from "./components/StatusNotification.tsx";
import Emitter from "./webgl/utils/eventEmitter.ts";

/* -------------------------------- App setup ------------------------------- */
const webglRef = ref<HTMLCanvasElement | null>(null);
const isAppStarted = ref<boolean>(false);
const isAutoLoggingIn = ref<boolean>(false);

const apiUrl = import.meta.env.VITE_NGROK_URL;
const webglExperience = Experience.getInstance();

onMounted(async () => {
  // Initialize the WebGL experience
  await webglExperience.configure(webglRef.value);

  // Only after experience is initialized, fire event so that world entities are created
  Emitter.emit("appReady");

  // Look for JWT token, automatically log user in to last project
  await attemptAutoLogin();
});

onUnmounted(() => {
  webglExperience.destroy();
  Emitter.all.clear();
});

/* ---------------------------- Template handlers --------------------------- */
const handleStartApp = async () => {
  // Show statusNotification for loading in case of long login and image pull
  if (!isAutoLoggingIn.value) {
    Emitter.emit("appLoading", "Loading....");
  }

  // Transition login page -> app page
  isAppStarted.value = !isAppStarted.value;

  // Handle 1st image pull, future image pulls will be handled by events in EditorDashboard
  await ApiHandler.handleNextImage(apiUrl, webglExperience);

  // Get Vision API key from backend
  webglExperience.resources.apiKey = await ApiHandler.getApiKey(apiUrl);
};

/* ----------------------------- Helper methods ----------------------------- */
const attemptAutoLogin = async () => {
  // Retrieve the token, projectName, directoryPath from localStorage
  const token = localStorage.getItem("jwtToken");
  const projectName = localStorage.getItem("projectName");
  const directoryPath = localStorage.getItem("directoryPath");

  // Missing any of elements from localStorage
  if (!token || !projectName || !directoryPath) {
    return;
  }

  // Check that token isn't expired
  if (!(await ApiHandler.isTokenValid(apiUrl))) {
    return;
  }

  // Automatically start app
  isAutoLoggingIn.value = true;
  Emitter.emit("appSuccess", "Automatically logged in to previous project");
  await handleStartApp();
};
</script>

<template>
  <!-- Start/Login page -->
  <Transition
    leaveFromClass="opacity-100"
    leaveToClass="opacity-0"
    :leaveActiveClass="isAutoLoggingIn ? 'duration-[0ms]' : 'duration-[250ms]'"
  >
    <LoginPage
      v-if="!isAppStarted"
      id="loginPage"
      :handleStartApp="handleStartApp"
    />
  </Transition>

  <!-- Main app -->
  <Transition
    enterFromClass="opacity-0"
    enterToClass="opacity-100"
    enterActiveClass="duration-[1000ms]"
  >
    <main v-show="isAppStarted" :class="isAutoLoggingIn ? '' : 'delay-[250ms]'">
      <StatusNotification class="absolute top-0 left-1/2 -translate-x-1/2" />

      <EditorDashboard
        id="gui"
        class="absolute"
        :webgl-experience="webglExperience"
      />

      <canvas ref="webglRef"></canvas>
    </main>
  </Transition>
</template>
