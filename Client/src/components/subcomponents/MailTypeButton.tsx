import { defineComponent, PropType } from "vue";

export default defineComponent({
  props: {
    buttonType: {
      type: String as PropType<string>,
      required: true,
    },
    buttonVariable: {
      type: [Boolean, null] as PropType<true | false | null>,
      required: true,
    },
    roundTopCorners: {
      type: Boolean as PropType<boolean>,
      required: true,
    },
    roundBottomCorners: {
      type: Boolean as PropType<boolean>,
      required: true,
    },
    handleClick: {
      type: Function as PropType<(buttonType: string) => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <button
        onClick={() => props.handleClick(props.buttonType)}
        class={{
          "flex items-center py-2 px-3 gap-2 w-full border border-white/50 group hover:border-indigo-600 duration-300":
            true,
          "rounded-t-xl": props.roundTopCorners,
          "rounded-b-xl": props.roundBottomCorners,
        }}
      >
        <div
          class={{
            "h-5 w-5 rounded-full duration-300": true,
            "bg-green-500 ring-1 ring-white":
              props.buttonType.toLowerCase() !== "bad" &&
              props.buttonVariable === true,
            "bg-red-500 ring-1 ring-white":
              props.buttonType.toLowerCase() === "bad" &&
              props.buttonVariable === true,
            "ring-1 ring-white":
              props.buttonVariable === false || props.buttonVariable === null, // Handles false and null
          }}
        />
        <p class="text-white text-sm group-hover:text-indigo-200 duration-300">
          {props.buttonType}
        </p>
      </button>
    );
  },
});
