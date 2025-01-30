import { defineComponent, ref, PropType, onMounted, onUnmounted } from "vue";
import Emitter from "../../webgl/utils/eventEmitter";
import MailTypeButton from "./MailTypeButton";

export default defineComponent({
  props: {
    color: {
      type: String as PropType<string>,
      required: true,
    },
    id: {
      type: Number as PropType<number>,
      required: true,
    },
    setTextArea: {
      type: Function as PropType<(newValue: string) => string>,
      required: true,
    },
    // Optional
    isActive: {
      type: Boolean as PropType<boolean>,
      required: false,
    },
  },
  setup(props) {
    // Track the current type for this group
    const currentType = ref<string>("");

    // Listen for setGroupType events for this group
    Emitter.on("setGroupType", ({ groupId, type }) => {
      if (groupId === props.id) {
        currentType.value = type;
      }
    });

    // Ugly method to intercept programmatic changes to textArea. Only way I could consistantly get it working since textArea.value.value is changed outside of Vue reactivity system
    const value = ref<string>("");
    let isUpdating = false;
    let originalDescriptor: PropertyDescriptor | undefined;
    let resizeObserver: ResizeObserver | null;

    // Setup value property interceptor on mount
    onMounted(() => {
      const element = document.getElementById(
        `dashboardTextarea${props.id}`
      ) as HTMLTextAreaElement;
      if (!element) {
        return;
      }

      // Initial value sync
      value.value = element.value;

      // Intercept value property
      originalDescriptor = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      );

      Object.defineProperty(element, "value", {
        get: () => originalDescriptor?.get?.call(element),
        set: (newValue: string) => {
          if (isUpdating) return;
          isUpdating = true;

          originalDescriptor?.set?.call(element, newValue);

          if (value.value !== newValue) {
            // Normalize newlines to \n
            const normalizedValue = newValue
              .replace(/\r\n/g, "\n")
              .replace(/\r/g, "\n");

            value.value = normalizedValue;
            props.setTextArea(normalizedValue);
          }

          isUpdating = false;
        },
        configurable: true,
      });

      // Add focus event listener to emit changeSelectionGroup
      element.addEventListener("focus", () => {
        Emitter.emit("changeSelectionGroup", props.id);
      });

      // Use ResizeObserver to detect resizing
      resizeObserver = new ResizeObserver(() => {
        Emitter.emit("changeSelectionGroup", props.id);
        element.focus();
      });

      resizeObserver.observe(element);
    });

    // Cleanup, restore the original value descriptor on unmount
    onUnmounted(() => {
      const element = document.getElementById(
        `dashboardTextarea${props.id}`
      ) as HTMLTextAreaElement;
      // Restore the original value descriptor
      if (element && originalDescriptor) {
        Object.defineProperty(element, "value", originalDescriptor);
      }

      // Remove the focus event listener
      element?.removeEventListener("focus", () => {
        Emitter.emit("changeSelectionGroup", props.id);
      });

      // Disconnect the resize observer
      resizeObserver?.disconnect();
      resizeObserver = null;
    });

    /* ----------------------------- Render function ---------------------------- */
    return () => (
      <div class="flex pb-2">
        {/* Textarea */}
        <textarea
          rows="3"
          id={`dashboardTextarea${props.id}`}
          value={value.value}
          onInput={(event) => {
            const normalizedValue = (event.target as HTMLTextAreaElement).value
              .replace(/\r\n/g, "\n")
              .replace(/\r/g, "\n");
            value.value = normalizedValue;

            props.setTextArea(normalizedValue);
          }}
          onClick={() => {
            Emitter.emit("changeSelectionGroup", props.id);
          }}
          class={[
            "min-w-[18.5rem] max-w-[18.5rem] min-h-[7.125rem] resize bg-transparent text-gray-100 text-sm leading-6 rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400",
            props.isActive &&
              "ring-2 ring-inset ring-indigo-600 focus:ring-[2.3px] focus:ring-indigo-600 focus:ring-inset",
          ]}
        />

        {/* Mailtype buttons */}
        <div class="ml-2 flex flex-col justify-center">
          <MailTypeButton
            buttonType={"MP"}
            buttonVariable={currentType.value === "MP" ? true : null}
            roundTopCorners={true}
            roundBottomCorners={false}
            handleClick={() => {
              Emitter.emit("setGroupType", {
                groupId: props.id,
                type: currentType.value === "MP" ? "" : "MP",
              });
            }}
          />
          <MailTypeButton
            buttonType={"HW"}
            buttonVariable={currentType.value === "HW" ? true : null}
            roundTopCorners={false}
            roundBottomCorners={false}
            handleClick={() => {
              Emitter.emit("setGroupType", {
                groupId: props.id,
                type: currentType.value === "HW" ? "" : "HW",
              });
            }}
          />
          <MailTypeButton
            buttonType={"Bad"}
            buttonVariable={currentType.value === "Bad" ? true : null}
            roundTopCorners={false}
            roundBottomCorners={true}
            handleClick={() => {
              Emitter.emit("setGroupType", {
                groupId: props.id,
                type: currentType.value === "Bad" ? "" : "Bad",
              });
            }}
          />
        </div>

        {/* Color indicator bar */}
        <div
          class={`w-2 min-h-full rounded-sm ml-2 bg-${props.color}-500`}
          aria-hidden="true"
        ></div>
      </div>
    );
  },
});
