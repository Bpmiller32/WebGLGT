import { defineComponent, PropType } from "vue";

export default defineComponent({
  props: {
    color: {
      type: String as PropType<string>,
      required: true,
    },
    id: {
      type: String as PropType<string>,
      required: true,
    },
    // Optional
    isActive: {
      type: Boolean as PropType<boolean>,
      required: false,
    },
  },
  setup(props) {
    return () => (
      <div class="flex pb-2">
        <textarea
          // Passing down the ref from the parent
          rows="3"
          id={props.id}
          class={[
            "bg-transparent text-gray-100 text-sm leading-6 resize-none w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400",
            props.isActive &&
              "ring-2 ring-inset ring-indigo-600 focus:ring-[2.3px] focus:ring-indigo-600 focus:ring-inset",
            !props.isActive &&
              "focus:ring-2 focus:ring-gray-300 focus:ring-inset",
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
