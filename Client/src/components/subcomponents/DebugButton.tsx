import { defineComponent, PropType } from "vue";

export default defineComponent({
  props: {
    isButtonEnabled: {
      type: Boolean as PropType<boolean>,
      required: true,
    },
    handleButtonClicked: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    return () => {
      return props.isButtonEnabled ? (
        <button
          onClick={props.handleButtonClicked}
          class="flex items-center w-fit py-2 px-3 rounded-xl border border-white/50 group hover:border-indigo-600 duration-300"
        >
          <p class="text-white text-sm group-hover:text-indigo-200 duration-300">
            Admin
          </p>
        </button>
      ) : null;
    };
  },
});
