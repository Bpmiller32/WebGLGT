import { defineComponent, PropType, Ref } from "vue";

export default defineComponent({
  props: {
    color: {
      type: String,
      required: true,
    },
    id: {
      type: String,
      required: true,
    },
    // Optional
    textAreaRef: {
      type: Object as PropType<Ref<HTMLTextAreaElement | null>>,
      required: false,
    },
  },
  setup(props) {
    return () => (
      <div class="flex pb-2">
        <textarea
          // Passing down the ref from the parent
          ref={props.textAreaRef}
          rows="3"
          id={props.id}
          class="bg-transparent text-gray-100 text-sm leading-6 resize-none w-full rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
        />
        <div
          class={`w-2 min-h-full rounded-sm ml-2 bg-${props.color}-500`}
          aria-hidden="true"
        ></div>
      </div>
    );
  },
});
