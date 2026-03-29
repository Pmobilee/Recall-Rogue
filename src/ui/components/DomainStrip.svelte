<script lang="ts">
  import { getKnowledgeDomains, getDomainMetadata } from '../../data/domainMetadata';
  import DomainStripCard from './DomainStripCard.svelte';

  interface Props {
    selectedDomains: string[];
    onDomainsChange: (domains: string[]) => void;
  }

  let { selectedDomains, onDomainsChange }: Props = $props();

  const allDomains = getKnowledgeDomains().map((id) => getDomainMetadata(id));
  const availableDomains = allDomains.filter((d) => !d.comingSoon);
  const lockedDomains = allDomains.filter((d) => d.comingSoon);

  const allSelected = $derived(availableDomains.every((d) => selectedDomains.includes(d.id)));

  function toggleAll() {
    if (allSelected) {
      onDomainsChange([]);
    } else {
      onDomainsChange(availableDomains.map((d) => d.id));
    }
  }

  function toggleDomain(id: string) {
    if (selectedDomains.includes(id)) {
      onDomainsChange(selectedDomains.filter((d) => d !== id));
    } else {
      onDomainsChange([...selectedDomains, id]);
    }
  }
</script>

<div class="domain-strip-wrapper">
  <div class="domain-strip">
    <!-- ALL card -->
    <DomainStripCard
      domainId="__all"
      shortName="All"
      icon="🌐"
      colorTint="#6366f1"
      isSelected={allSelected}
      isLocked={false}
      ontoggle={toggleAll}
    />

    <!-- Available domains -->
    {#each availableDomains as domain (domain.id)}
      <DomainStripCard
        domainId={domain.id}
        shortName={domain.shortName}
        icon={`/assets/sprites/icons/icon_domain_${domain.id}.png`}
        colorTint={domain.colorTint}
        isSelected={selectedDomains.includes(domain.id)}
        isLocked={false}
        ontoggle={toggleDomain}
      />
    {/each}

    <!-- Locked / coming soon domains -->
    {#each lockedDomains as domain (domain.id)}
      <DomainStripCard
        domainId={domain.id}
        shortName={domain.shortName}
        icon={`/assets/sprites/icons/icon_domain_${domain.id}.png`}
        colorTint={domain.colorTint}
        isSelected={false}
        isLocked={true}
        ontoggle={toggleDomain}
      />
    {/each}
  </div>
</div>

<style>
  .domain-strip-wrapper {
    position: relative;
    flex-shrink: 0;
    background: rgba(10, 14, 26, 0.4);
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .domain-strip-wrapper::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: calc(60px * var(--layout-scale, 1));
    background: linear-gradient(to left, rgba(10, 14, 26, 0.95), transparent);
    pointer-events: none;
    z-index: 1;
  }

  .domain-strip {
    display: flex;
    gap: calc(8px * var(--layout-scale, 1));
    padding: calc(12px * var(--layout-scale, 1)) calc(20px * var(--layout-scale, 1));
    overflow-x: auto;
    scrollbar-width: none;
  }

  .domain-strip::-webkit-scrollbar {
    display: none;
  }
</style>
