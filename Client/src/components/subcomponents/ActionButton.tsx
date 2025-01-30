import { defineComponent, PropType } from "vue";
import {
  ScissorsIcon,
  MagnifyingGlassCircleIcon,
  ArrowUturnLeftIcon,
  BackwardIcon,
  ForwardIcon,
  BookmarkIcon,
} from "@heroicons/vue/16/solid";

export default defineComponent({
  props: {
    buttonType: {
      type: String as PropType<string>,
      required: true,
    },
    roundLeftCorner: {
      type: Boolean as PropType<boolean>,
      required: true,
    },
    roundRightCorner: {
      type: Boolean as PropType<boolean>,
      required: true,
    },
    handleClick: {
      type: Function as PropType<(buttonType: string) => void>,
      required: true,
    },
    // Optional, to conditionally display text
    showText: {
      type: Boolean as PropType<boolean>,
      default: false,
    },
    disabled: {
      type: Boolean as PropType<boolean>,
      default: false,
    },
  },
  setup(props) {
    // Function to select the correct icon based on the button type
    const renderIcon = () => {
      switch (props.buttonType) {
        case "Cut":
          return (
            <ScissorsIcon class="h-5 w-5 text-gray-100 group-enabled:transition-colors group-enabled:duration-300 group-hover:text-indigo-100 group-disabled:text-gray-400" />
          );
        case "SendToVision":
          return (
            <MagnifyingGlassCircleIcon class="h-5 w-5 text-gray-100 group-enabled:transition-colors group-enabled:duration-300 group-hover:text-indigo-100 group-disabled:text-gray-400" />
          );
        case "Reset":
          return (
            <ArrowUturnLeftIcon class="h-5 w-5 text-gray-100 group-enabled:transition-colors group-enabled:duration-300 group-hover:text-indigo-100 group-disabled:text-gray-400" />
          );
        case "Save":
          return (
            <BookmarkIcon class="h-5 w-5 text-gray-100 group-enabled:transition-colors group-enabled:duration-300 group-hover:text-indigo-100 group-disabled:text-gray-400" />
          );
        case "Prev":
          return (
            <BackwardIcon class="h-5 w-5 text-gray-100 group-enabled:transition-colors group-enabled:duration-300 group-hover:text-indigo-100 group-disabled:text-gray-400" />
          );
        case "Next":
          return (
            <ForwardIcon class="h-5 w-5 text-gray-100 group-enabled:transition-colors group-enabled:duration-300 group-hover:text-indigo-100 group-disabled:text-gray-400" />
          );
        case "Group0":
          return (
            <div class="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white text-xs font-bold">
              0
            </div>
          );
        case "Group1":
          return (
            <div class="flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
              1
            </div>
          );
        case "Group2":
          return (
            <div class="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold">
              2
            </div>
          );
        default:
          return null;
      }
    };

    return () => (
      <button
        onClick={() => !props.disabled && props.handleClick(props.buttonType)}
        disabled={props.disabled}
        class={{
          "flex items-center py-2 px-3 gap-2 border group": true,
          "border-white/50 hover:border-indigo-600 opacity-100 enabled:transition-all enabled:duration-300": !props.disabled,
          "border-white/20 cursor-not-allowed opacity-50": props.disabled,
          "rounded-l-xl": props.roundLeftCorner,
          "rounded-r-xl": props.roundRightCorner,
        }}
      >
        {renderIcon()}
        {props.showText && (
          <p class="text-white text-sm group-enabled:transition-colors group-enabled:duration-300 group-hover:text-indigo-100 group-disabled:text-gray-400">
            {props.buttonType}
          </p>
        )}
      </button>
    );
  },
});
