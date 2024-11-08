import { defineComponent, Transition } from "vue";

export default defineComponent({
  props: {
    isServerOnline: {
      type: Boolean,
      required: true,
    },
  },
  setup(props) {
    const ServerStatusBadgeIcon = () => {
      if (props.isServerOnline) {
        return (
          <Transition
            enterFromClass="opacity-0"
            enterToClass="opacity-100"
            enterActiveClass="duration-[500ms]"
            mode="out-in"
          >
            <div key="green" class="h-1.5 w-1.5 bg-green-500 rounded-full" />
          </Transition>
        );
      } else {
        return (
          <Transition
            enterFromClass="opacity-0"
            enterToClass="opacity-100"
            enterActiveClass="duration-[500ms]"
            mode="out-in"
          >
            <div key="red" class="h-1.5 w-1.5 bg-red-500 rounded-full" />
          </Transition>
        );
      }
    };

    return () => (
      <span class="mb-2 inline-flex items-center gap-x-1.5 rounded-full px-2 py-1 text-xs font-medium text-gray-100 ring-1 ring-inset ring-gray-200">
        {ServerStatusBadgeIcon()}
        Server status
      </span>
    );
  },
});
