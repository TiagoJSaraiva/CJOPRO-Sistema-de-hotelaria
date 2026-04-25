"use client";

import { useState } from "react";

export function useViewFiltersState<T extends Record<string, string>>(defaultFilters: T) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<T>(defaultFilters);
  const [draftFilters, setDraftFilters] = useState<T>(defaultFilters);

  const openFilters = () => {
    setDraftFilters(appliedFilters);
    setIsModalOpen(true);
  };

  const closeFilters = () => {
    setIsModalOpen(false);
  };

  const applyFilters = () => {
    setAppliedFilters(draftFilters);
    setIsModalOpen(false);
  };

  const clearFilters = () => {
    setAppliedFilters(defaultFilters);
    setDraftFilters(defaultFilters);
    setIsModalOpen(false);
  };

  const updateDraftFilter = <K extends keyof T>(key: K, value: T[K]) => {
    setDraftFilters((current) => ({
      ...current,
      [key]: value
    }));
  };

  return {
    isModalOpen,
    appliedFilters,
    draftFilters,
    setDraftFilters,
    openFilters,
    closeFilters,
    applyFilters,
    clearFilters,
    updateDraftFilter
  };
}