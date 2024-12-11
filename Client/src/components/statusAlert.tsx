import Emitter from "../webgl/utils/eventEmitter";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/vue/16/solid";
import { defineComponent, ref, Transition } from "vue";

export default defineComponent({
  setup() {
    /* ------------------------ Component state and setup ----------------------- */
    const isAlertEnabled = ref(false);
    const statusAlertText = ref();
    const statusAlertColor = ref();

    /* --------------------------------- Events --------------------------------- */
    Emitter.on("indicateLoading", () => {
      statusAlertText.value = "Loading....";
      statusAlertColor.value = "yellow";
      isAlertEnabled.value = true;
    });

    Emitter.on("fillInForm", () => {
      // Cover case where resubmitting, indicate to user with 2nd animation by disabling/enabling
      if (
        statusAlertText.value === "Successfully uploaded" &&
        statusAlertColor.value === "green" &&
        isAlertEnabled.value === true
      ) {
        isAlertEnabled.value = false;

        setTimeout(() => {
          isAlertEnabled.value = true;
        }, 100);
        return;
      }

      statusAlertText.value = "Successfully uploaded";
      statusAlertColor.value = "green";
      isAlertEnabled.value = true;
    });

    Emitter.on("gotoNextImage", () => {
      statusAlertText.value = "Loading next image....";
      statusAlertColor.value = "yellow";
      isAlertEnabled.value = true;
    });

    Emitter.on("loadedFromApi", () => {
      isAlertEnabled.value = false;
    });

    Emitter.on("appError", () => {
      statusAlertText.value = "Error";
      statusAlertColor.value = "red";
      isAlertEnabled.value = true;
    });

    /* ------------------------------ Subcomponents ----------------------------- */
    const StatusAlert = () => {
      if (statusAlertColor.value === "green") {
        return (
          <div class="rounded-md bg-green-50 p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <CheckCircleIcon class="h-5 w-5 text-green-400" />
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-green-800">
                  {statusAlertText.value}
                </p>
              </div>
            </div>
          </div>
        );
      } else if (statusAlertColor.value === "yellow") {
        return (
          <div class="rounded-md bg-yellow-50 p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <ArrowPathIcon class="h-5 w-5 text-yellow-400 animate-spin" />
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-yellow-800">
                  {statusAlertText.value}
                </p>
              </div>
            </div>
          </div>
        );
      } else {
        return (
          <div class="rounded-md bg-red-50 p-3">
            <div class="flex">
              <div class="flex-shrink-0">
                <ExclamationCircleIcon class="h-5 w-5 text-red-400" />
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-red-800">
                  {statusAlertText.value}
                </p>
              </div>
            </div>
          </div>
        );
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
        {() => {
          if (isAlertEnabled.value) {
            return <article class="mt-4 max-w-60">{StatusAlert()}</article>;
          }
        }}
      </Transition>
    );
  },
});
