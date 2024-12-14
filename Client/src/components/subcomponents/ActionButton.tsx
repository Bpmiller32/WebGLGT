import { defineComponent, PropType } from "vue";
import {
  ScissorsIcon,
  MagnifyingGlassCircleIcon,
  ArrowUturnLeftIcon,
  ArrowUpCircleIcon,
  BackwardIcon,
  ForwardIcon,
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
  },
  setup(props) {
    // Function to select the correct icon based on the button type
    const renderIcon = () => {
      switch (props.buttonType) {
        case "Cut":
          return (
            <ScissorsIcon class="h-5 w-5 text-gray-100 group-hover:text-indigo-100 duration-300" />
          );
        case "SendToVision":
          return (
            <MagnifyingGlassCircleIcon class="h-5 w-5 text-gray-100 group-hover:text-indigo-100 duration-300" />
          );
        case "Reset":
          return (
            <ArrowUturnLeftIcon class="h-5 w-5 text-gray-100 group-hover:text-indigo-100 duration-300" />
          );

        case "Send":
          return (
            <ArrowUpCircleIcon class="h-5 w-5 text-gray-100 transition-colors group-hover:text-indigo-100 duration-300" />
          );
        case "Prev":
          return (
            <BackwardIcon class="h-5 w-5 text-gray-100 transition-colors group-hover:text-indigo-100 duration-300" />
          );
        case "Next":
          return (
            <ForwardIcon class="h-5 w-5 text-gray-100 transition-colors group-hover:text-indigo-100 duration-300" />
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
        onClick={() => props.handleClick(props.buttonType)}
        class={{
          "flex items-center py-2 px-3 gap-2 border border-white/50 group hover:border-indigo-600 duration-300":
            true,
          "rounded-l-xl": props.roundLeftCorner,
          "rounded-r-xl": props.roundRightCorner,
        }}
      >
        {renderIcon()}
        {props.showText && (
          <p class="text-white text-sm group-hover:text-indigo-100 duration-300">
            {props.buttonType}
          </p>
        )}
      </button>
    );
  },
});
