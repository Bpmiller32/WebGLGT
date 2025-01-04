import { defineComponent } from "vue";
import groundTruth2Logo from "../../assets/groundTruth2Logo.webp";

export default defineComponent({
  setup() {
    return () => (
      <div class="mb-5 flex justify-center select-none cursor-default">
        <img src={groundTruth2Logo} class="h-8" alt="groundTruth2Logo" />
      </div>
    );
  },
});
