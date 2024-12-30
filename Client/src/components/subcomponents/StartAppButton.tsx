import { defineComponent, PropType } from "vue";

export default defineComponent({
  props: {
    isButtonEnabled: {
      type: Boolean as PropType<boolean>,
      required: true,
    },
    isServerOnline: {
      type: Boolean as PropType<boolean>,
      required: true,
    },
    handleButtonClicked: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <button
        type="button"
        onClick={
          props.isButtonEnabled && props.isServerOnline
            ? props.handleButtonClicked
            : undefined
        }
        class={[
          "rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm duration-300",
          props.isButtonEnabled && props.isServerOnline
            ? "bg-indigo-600 hover:bg-indigo-500 focus-visible:outline-indigo-600"
            : "cursor-not-allowed bg-gray-600",
        ].join(" ")}
      >
        Start App
      </button>
    );
  },
});
