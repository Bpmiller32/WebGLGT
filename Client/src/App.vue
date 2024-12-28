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

/* ---------------------------- Template handlers --------------------------- */
const handleStartApp = async () => {
  // Show statusNotification for loading in case of long login and image pull
  Emitter.emit("appLoading", "Loading....");

  // Transition login page -> app page
  isAppStarted.value = !isAppStarted.value;

  // Handle 1st image pull, future image pulls will be handled by events in EditorDashboard
  await ApiHandler.handleNextImage(apiUrl, webglExperience);

  // Get Vision API key from backend
  webglExperience.resources.apiKey = await ApiHandler.getApiKey(apiUrl);
};
</script>

<template>
  <!-- Start/Login page -->
  <Transition
    leaveFromClass="opacity-100"
    leaveToClass="opacity-0"
    leaveActiveClass="duration-[500ms]"
  >
    <LoginPage
      v-if="!isAppStarted"
      id="loginPage"
      :apiUrl="apiUrl"
      :handleStartApp="handleStartApp"
    />
  </Transition>

  <!-- Main app -->
  <Transition
    enterFromClass="opacity-0"
    enterToClass="opacity-100"
    enterActiveClass="duration-[2500ms]"
  >
    <main v-show="isAppStarted" class="delay-[500ms]">
      <StatusNotification class="absolute top-0 left-1/2 -translate-x-1/2" />

      <EditorDashboard
        id="gui"
        class="absolute"
        :apiUrl="apiUrl"
        :webgl-experience="webglExperience"
      />

      <canvas ref="webglRef"></canvas>
    </main>
  </Transition>
</template>
