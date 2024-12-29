import Emitter from "../webgl/utils/eventEmitter";
import { defineComponent, ref, Transition } from "vue";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/vue/16/solid";
import StatusAlert from "./subcomponents/StatusAlert";

export default defineComponent({
  setup() {
    /* ------------------------ Component state and setup ----------------------- */
    const isAlertEnabled = ref<boolean>(false);
    const isAlertVisibilityExtended = ref<boolean>(false);
    const statusAlertText = ref<string | undefined>();
    const statusAlertColor = ref<
      "success" | "loading" | "warning" | "error" | undefined
    >();

    const statusAlertConfig = {
      success: {
        container: "bg-green-50",
        text: "text-green-800",
        icon: <CheckCircleIcon class="h-5 w-5 text-green-400" />,
      },
      loading: {
        container: "bg-yellow-50",
        text: "text-yellow-800",
        icon: <ArrowPathIcon class="h-5 w-5 text-yellow-400 animate-spin" />,
      },
      warning: {
        container: "bg-yellow-50",
        text: "text-yellow-800",
        icon: <ExclamationTriangleIcon class="h-5 w-5 text-yellow-400" />,
      },
      error: {
        container: "bg-red-50",
        text: "text-red-800",
        icon: <ExclamationCircleIcon class="h-5 w-5 text-red-400" />,
      },
    };

    /* ---------------------------- Lifecycle Events ---------------------------- */
    Emitter.on("fillInForm", () => {
      // Covers case where resubmitting, indicate to user with 2nd animation by disabling/enabling with toggleAlert
      updateAlert("Successfully uploaded", "success");
      toggleAlert();
    });
    Emitter.on("gotoNextImage", () => {
      updateAlert("Loading next image....", "loading");
    });
    Emitter.on("gotoPrevImage", () => {
      updateAlert("Loading previous image....", "loading");
    });
    Emitter.on("loadedFromApi", () => {
      // Force keep notifications up
      setTimeout(
        () => {
          isAlertEnabled.value = false;
          isAlertVisibilityExtended.value = false;
        },
        isAlertVisibilityExtended.value ? 2000 : 0
      );
    });
    Emitter.on("stitchBoxes", () => {
      isAlertEnabled.value = false;
    });
    Emitter.on("screenshotImage", () => {
      isAlertEnabled.value = false;
    });
    Emitter.on("resetImage", () => {
      isAlertEnabled.value = false;
    });
    Emitter.on("appSuccess", (message: string) => {
      isAlertVisibilityExtended.value = true;
      updateAlert(message, "success");
      toggleAlert();
    });
    Emitter.on("appLoading", (message: string) => {
      updateAlert(message, "loading");
    });
    Emitter.on("appWarning", (message: string) => {
      updateAlert(message, "warning");
      toggleAlert();
    });
    Emitter.on("appError", (message: string) => {
      // ToggleAlert fixes bug where loading updateAlert wasn't "finished"
      updateAlert(message, "error");
      toggleAlert();
    });

    /* ---------------------------- Helper Methods ---------------------------- */
    const updateAlert = (
      text: string,
      color: "success" | "loading" | "warning" | "error"
    ) => {
      statusAlertText.value = text;
      statusAlertColor.value = color;
      isAlertEnabled.value = true;
    };

    const toggleAlert = () => {
      isAlertEnabled.value = false;

      setTimeout(() => {
        isAlertEnabled.value = true;
      }, 100);
    };

    /* ----------------------------- Render function ---------------------------- */
    return () => (
      <Transition
        enterFromClass="opacity-0 -translate-y-full"
        enterToClass="opacity-100 translate-y-0"
        enterActiveClass="transition duration-[500ms]"
        leaveFromClass="opacity-100 translate-y-0"
        leaveToClass="opacity-0 -translate-y-full"
        leaveActiveClass="transition duration-[500ms]"
      >
        {isAlertEnabled.value && (
          <article class="mt-4 max-w-60">
            <StatusAlert
              statusAlertColor={statusAlertColor.value}
              statusAlertText={statusAlertText.value || ""}
              statusAlertConfig={statusAlertConfig}
            />
          </article>
        )}
      </Transition>
    );
  },
});
