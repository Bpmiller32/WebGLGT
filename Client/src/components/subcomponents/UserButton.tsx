import { defineComponent, PropType } from "vue";
import { JSX } from "vue/jsx-runtime";

export default defineComponent({
  props: {
    icon: {
      type: Object as PropType<JSX.Element>,
      required: true,
    },
    handleClick: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <button
        onClick={props.handleClick}
        class="py-2 px-2 rounded-full border border-white/50 group hover:border-indigo-600 duration-300"
      >
        <div class="text-white group-hover:text-indigo-200 duration-300">
          {props.icon}
        </div>
      </button>
    );
  },
});
