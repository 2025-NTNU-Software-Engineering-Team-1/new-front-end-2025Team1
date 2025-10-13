<script setup lang="ts">
import { inject, onMounted, Ref, ref } from "vue";
import LanguageMultiSelect from "../../Forms/LanguageMultiSelect.vue";
import MultiStringInput from "../Controls/MultiStringInput.vue";
import api from "@/models/api";

const problem = inject<Ref<ProblemForm>>("problem") as Ref<ProblemForm>;

const libraryOptions = ref<string[]>([]);
onMounted(async () => {
  try {
    const { librarySymbols } = await api.Problem.getStaticAnalysisOptions();
    libraryOptions.value = librarySymbols || [];
  } catch {
    libraryOptions.value = [];
  }
});

function ensureConfig() {
  if (!problem.value.config) {
    problem.value.config = {
      compilation: false,
      testMode: false,
      aiVTuber: false,
      acceptedFormat: "code",
      staticAnalys: {
        custom: false,
        libraryRestrictions: { enabled: false, whitelist: [], blacklist: [] },
        networkAccessRestrictio: {
          enabled: false,
          firewallExtranet: { enabled: false, whitelist: [], blacklist: [] },
          connectWithLocal: { enabled: false, whitelist: [], blacklist: [], localServiceZip: null },
        },
      },
      artifactCollection: [],
    };
  }
}
ensureConfig();

function toggleArray(arr: string[], value: string) {
  const idx = arr.indexOf(value);
  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(value);
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <!-- allowedLanguage -->
    <div class="form-control w-full max-w-xs">
      <label class="label"><span class="label-text">Allowed Languages</span></label>
      <language-multi-select
        :model-value="problem.allowedLanguage"
        @update:model-value="(v) => (problem.allowedLanguage = v)"
      />
    </div>

    <!-- tags -->
    <div class="form-control w-full max-w-xs">
      <label class="label"><span class="label-text">Tags</span></label>
      <input
        type="text"
        class="input input-bordered w-full max-w-xs"
        :value="problem.tags.join(',')"
        @input="problem.tags = ($event.target as HTMLInputElement).value.split(',').map((s) => s.trim()).filter(Boolean)"
      />
      <label class="label"><span class="label-text-alt">Comma separated</span></label>
    </div>

    <!-- quota -->
    <div class="form-control w-full max-w-xs">
      <label class="label"><span class="label-text">Quota</span></label>
      <input
        type="number"
        class="input input-bordered w-full max-w-xs"
        :value="problem.quota"
        @input="problem.quota = Number(($event.target as HTMLInputElement).value)"
      />
      <label class="label"><span class="label-text-alt">-1 means unlimited</span></label>
    </div>

    <!-- compilation -->
    <div class="form-control">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">Compilation</span>
        <input type="checkbox" class="toggle" v-model="problem.config!.compilation" />
      </label>
    </div>

    <!-- testMode -->
    <div class="form-control">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">Test mode</span>
        <input type="checkbox" class="toggle" v-model="problem.config!.testMode" />
      </label>
    </div>

    <!-- aiVTuber -->
    <div class="form-control">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">AI VTuber</span>
        <input type="checkbox" class="toggle" v-model="problem.config!.aiVTuber" />
      </label>
    </div>

    <!-- acceptedFormat -->
    <div class="form-control">
      <label class="label"><span class="label-text">Accepted format</span></label>
      <div class="flex gap-4">
        <label class="label cursor-pointer gap-2">
          <input type="radio" name="acceptedFormat" class="radio" value="code" v-model="(problem.config!.acceptedFormat as any)" />
          <span class="label-text">code</span>
        </label>
        <label class="label cursor-pointer gap-2">
          <input type="radio" name="acceptedFormat" class="radio" value="zip" v-model="(problem.config!.acceptedFormat as any)" />
          <span class="label-text">zip</span>
        </label>
      </div>
    </div>

    <!-- static analysis -->
    <div class="form-control col-span-1 md:col-span-2">
      <label class="label cursor-pointer justify-start gap-x-4">
        <span class="label-text">Static analysis - Custom</span>
        <input type="checkbox" class="toggle" v-model="problem.config!.staticAnalys.custom" />
      </label>

      <div v-if="problem.config!.staticAnalys.custom" class="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- Library restrictions -->
        <div class="rounded-box bg-base-200 p-3">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">Library restrictions</span>
            <input type="checkbox" class="toggle" v-model="problem.config!.staticAnalys.libraryRestrictions!.enabled" />
          </label>
          <div v-if="problem.config!.staticAnalys.libraryRestrictions!.enabled" class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <div>
              <div class="label-text mb-1">Whitelist</div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="sym in libraryOptions"
                  :key="`w-${sym}`"
                  class="btn btn-xs"
                  :class="problem.config!.staticAnalys.libraryRestrictions!.whitelist.includes(sym) && 'btn-accent'"
                  @click="toggleArray(problem.config!.staticAnalys.libraryRestrictions!.whitelist, sym)"
                >{{ sym }}</button>
              </div>
            </div>
            <div>
              <div class="label-text mb-1">Blacklist</div>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="sym in libraryOptions"
                  :key="`b-${sym}`"
                  class="btn btn-xs"
                  :class="problem.config!.staticAnalys.libraryRestrictions!.blacklist.includes(sym) && 'btn-error text-base-100'"
                  @click="toggleArray(problem.config!.staticAnalys.libraryRestrictions!.blacklist, sym)"
                >{{ sym }}</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Network access restriction -->
        <div class="rounded-box bg-base-200 p-3">
          <label class="label cursor-pointer justify-start gap-x-4">
            <span class="label-text">Network access restriction</span>
            <input type="checkbox" class="toggle" v-model="problem.config!.staticAnalys.networkAccessRestrictio!.enabled" />
          </label>

          <div v-if="problem.config!.staticAnalys.networkAccessRestrictio!.enabled" class="mt-2 grid grid-cols-1 gap-3">
            <div class="rounded bg-base-300 p-3">
              <label class="label cursor-pointer justify-start gap-x-4">
                <span class="label-text">Firewall extranet</span>
                <input type="checkbox" class="toggle" v-model="problem.config!.staticAnalys.networkAccessRestrictio!.firewallExtranet!.enabled" />
              </label>
              <div v-if="problem.config!.staticAnalys.networkAccessRestrictio!.firewallExtranet!.enabled" class="grid md:grid-cols-2 gap-3 mt-2">
                <MultiStringInput v-model="problem.config!.staticAnalys.networkAccessRestrictio!.firewallExtranet!.whitelist" placeholder="Add whitelist host/IP" />
                <MultiStringInput v-model="problem.config!.staticAnalys.networkAccessRestrictio!.firewallExtranet!.blacklist" placeholder="Add blacklist host/IP" />
              </div>
            </div>

            <div class="rounded bg-base-300 p-3">
              <label class="label cursor-pointer justify-start gap-x-4">
                <span class="label-text">Connect with local</span>
                <input type="checkbox" class="toggle" v-model="problem.config!.staticAnalys.networkAccessRestrictio!.connectWithLocal!.enabled" />
              </label>
              <div v-if="problem.config!.staticAnalys.networkAccessRestrictio!.connectWithLocal!.enabled" class="grid md:grid-cols-2 gap-3 mt-2">
                <MultiStringInput v-model="problem.config!.staticAnalys.networkAccessRestrictio!.connectWithLocal!.whitelist" placeholder="Add whitelist host/IP" />
                <MultiStringInput v-model="problem.config!.staticAnalys.networkAccessRestrictio!.connectWithLocal!.blacklist" placeholder="Add blacklist host/IP" />
              </div>
              <div v-if="problem.config!.staticAnalys.networkAccessRestrictio!.connectWithLocal!.enabled" class="form-control mt-2">
                <label class="label"><span class="label-text">Upload local_service.zip</span></label>
                <input type="file" accept=".zip" class="file-input file-input-bordered" @change="(e:any) => problem.assets!.localServiceZip = e.target.files?.[0] || null" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- artifact collection -->
    <div class="form-control col-span-1 md:col-span-2">
      <label class="label"><span class="label-text">Artifact collection (optional)</span></label>
      <div class="flex gap-4">
        <label class="label cursor-pointer gap-2">
          <input
            type="checkbox"
            class="checkbox"
            :checked="problem.config!.artifactCollection.includes('compiledBinary')"
            @change="($event.target as HTMLInputElement).checked
              ? problem.config!.artifactCollection.push('compiledBinary')
              : problem.config!.artifactCollection = problem.config!.artifactCollection.filter(v => v !== 'compiledBinary')"
          />
          <span class="label-text">compiledBinary</span>
        </label>
        <label class="label cursor-pointer gap-2">
          <input
            type="checkbox"
            class="checkbox"
            :checked="problem.config!.artifactCollection.includes('zip')"
            @change="($event.target as HTMLInputElement).checked
              ? problem.config!.artifactCollection.push('zip')
              : problem.config!.artifactCollection = problem.config!.artifactCollection.filter(v => v !== 'zip')"
          />
          <span class="label-text">zip</span>
        </label>
      </div>
    </div>
  </div>
</template>