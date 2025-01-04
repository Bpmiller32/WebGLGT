import { defineComponent, ref, PropType, onMounted, onUnmounted } from "vue";
import Emitter from "../../webgl/utils/eventEmitter";

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
    // Ugly method to intercept programmatic changes to textArea. Only way I could consistantly get it working since textArea.value.value is changed outside of Vue reactivity system
    const value = ref<string>("");
    let isUpdating = false;
    let originalDescriptor: PropertyDescriptor | undefined;

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
    });

    // Cleanup, restore the original value descriptor on unmount
    onUnmounted(() => {
      const element = document.getElementById(
        `dashboardTextarea${props.id}`
      ) as HTMLTextAreaElement;
      if (element && originalDescriptor) {
        Object.defineProperty(element, "value", originalDescriptor);
      }
    });

    return () => (
      <div class="flex pb-2">
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
            "bg-transparent text-gray-100 text-sm leading-6 resize-none w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400",
            props.isActive &&
              "ring-2 ring-inset ring-indigo-600 focus:ring-[2.3px] focus:ring-indigo-600 focus:ring-inset",
          ]}
        />
        <div
          class={`w-2 min-h-full rounded-sm ml-2 bg-${props.color}-500`}
          aria-hidden="true"
        ></div>
      </div>
    );
  },
});
