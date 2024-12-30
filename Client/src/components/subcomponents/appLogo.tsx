import { defineComponent } from "vue";
import volarisLogo from "../../assets/volarisLogo.svg";

export default defineComponent({
  setup() {
    return () => (
      <div class="mb-5 select-none cursor-default">
        <img src={volarisLogo} class="h-5 w-full" alt="volarisLogo" />
      </div>
    );
  },
});
