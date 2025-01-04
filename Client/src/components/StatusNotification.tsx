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
    const isVisible = ref<boolean>(false);
    const message = ref<string>("");
    const alertType = ref<"success" | "loading" | "warning" | "error">(
      "success"
    );
    let dismissTimer: number | null = null;

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
      showNotification("Successfully uploaded", "success", 3000, false);
    });
    Emitter.on("gotoNextImage", () => {
      showNotification("Loading next image...", "loading", 5000, true);
    });
    Emitter.on("gotoPrevImage", () => {
      showNotification("Loading previous image...", "loading", 5000, true);
    });
    Emitter.on("loadedFromApi", () => {
      dismiss();
    });
    Emitter.on("stitchBoxes", () => {
      dismiss();
    });
    Emitter.on("screenshotImage", () => {
      dismiss();
    });
    Emitter.on("resetImage", () => {
      dismiss();
    });
    Emitter.on("appSuccess", (message: string) => {
      showNotification(message, "success", 3000, false);
    });
    Emitter.on("appLoading", (message: string) => {
      showNotification(message, "loading", 10000, true);
    });
    Emitter.on("appWarning", (message: string) => {
      showNotification(message, "warning", 4000, false);
    });
    Emitter.on("appError", (message: string) => {
      // error stays up until dismissed
      showNotification(message, "error", 0, true);
    });

    /* ---------------------------- Helper Methods ---------------------------- */
    const showNotification = (
      newMessage: string,
      newType: "success" | "loading" | "warning" | "error",
      duration: number = 3000,
      manualDismissAllowed = false
    ) => {
      // Dismiss any currently active notification first
      dismiss();

      // Update reactive state for the new notification
      message.value = newMessage;
      alertType.value = newType;
      isVisible.value = true;

      // If not manually dismissable, auto-dismiss after 'duration'
      if (!manualDismissAllowed && duration > 0) {
        dismissTimer = window.setTimeout(() => {
          dismiss();
        }, duration);
      }
    };

    const dismiss = () => {
      isVisible.value = false;

      if (dismissTimer) {
        clearTimeout(dismissTimer);
        dismissTimer = null;
      }
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
        {isVisible.value && (
          <article class="mt-4 max-w-60">
            <StatusAlert
              statusAlertColor={alertType.value}
              statusAlertText={message.value}
              statusAlertConfig={statusAlertConfig}
            />
          </article>
        )}
      </Transition>
    );
  },
});
