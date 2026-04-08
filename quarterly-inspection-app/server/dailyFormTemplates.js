const DEFAULT_DAILY_TEMPLATE = {
  templateId: "forklift_standard_v1",
  title: "Forklift Daily Safety Check",
  sections: [
    {
      id: "visual_check",
      title: "Visual Check",
      items: [
        {
          id: "visual_general_condition",
          label: "General condition of the forklift",
          required: true
        },
        {
          id: "visual_broken_cracked_or_loose_parts",
          label: "Broken, Cracked or Loose Parts",
          required: true
        },
        {
          id: "visual_overhead_guard_obstructions",
          label: "Check overhead guard / overhead obstructions",
          required: true
        },
        {
          id: "visual_fire_extinguisher_present_charged",
          label: "Fire extinguisher is present and charged",
          required: true
        },
        {
          id: "visual_signage_capacity_plate",
          label: "Signage and stickers legible / Capacity plate",
          required: true
        },
        {
          id: "visual_wheels_tires_condition",
          label: "Wheels and tires: wear, damage, air pressure",
          required: true
        },
        {
          id: "visual_forks_backrest_mast_chains_rollers",
          label: "Forks / Backrest / Mast / Chains / Rollers",
          required: true
        },
        {
          id: "visual_chain_anchor_pins",
          label: "Chain anchor pins",
          required: true
        },
        {
          id: "visual_fluid_leaks_ground",
          label: "Fluid leaks, no damp spots or drips on ground",
          required: true
        },
        {
          id: "visual_hoses_secure_no_leaks",
          label: "Hoses: secure, leaks, worn",
          required: true
        },
        {
          id: "visual_air_filter_cleanliness",
          label: "Air filter intake: cleanliness",
          required: true
        },
        {
          id: "visual_battery_connections",
          label: "Battery: plate, check cables, connections",
          required: true
        }
      ]
    },
    {
      id: "operational_check",
      title: "Operational Check",
      items: [
        {
          id: "operational_engine_not_rough",
          label: "Engine: not rough, no noise or leaks",
          required: true
        },
        {
          id: "operational_gauges_horn",
          label: "Gauges / Horn: loud and working",
          required: true
        },
        {
          id: "operational_lights_head_warning",
          label: "Lights: head lights and warning lights",
          required: true
        },
        {
          id: "operational_plugging_forward_reverse",
          label: "Plugging - test by driving forward and reverse",
          required: true
        },
        {
          id: "operational_steering",
          label: "Steering: loose, tight",
          required: true
        },
        {
          id: "operational_forks_motion_hydraulic",
          label:
            "Forks: Raise / Lower / Tilt / Sideshift / Extend / Retract : loose, sticks, leaks",
          required: true
        }
      ]
    }
  ]
};

// Override templates by exact serial (case-insensitive).
// Example:
// "sn-1007": {
//   templateId: "reach_truck_v1",
//   title: "Reach Truck Daily Safety Check",
//   sections: [...]
// }
const TEMPLATE_OVERRIDES_BY_SERIAL = {};

// Override templates by equipment type (case-insensitive).
// Example:
// "reach truck": { ...custom template... }
const TEMPLATE_OVERRIDES_BY_TYPE = {};

function normalizeKey(value) {
  return (value || "").toString().trim().toLowerCase();
}

function cloneTemplate(template) {
  return JSON.parse(JSON.stringify(template));
}

export function getDailyTemplateForEquipment({ serialNumber, type }) {
  const serialKey = normalizeKey(serialNumber);
  if (serialKey && TEMPLATE_OVERRIDES_BY_SERIAL[serialKey]) {
    return cloneTemplate(TEMPLATE_OVERRIDES_BY_SERIAL[serialKey]);
  }

  const typeKey = normalizeKey(type);
  if (typeKey && TEMPLATE_OVERRIDES_BY_TYPE[typeKey]) {
    return cloneTemplate(TEMPLATE_OVERRIDES_BY_TYPE[typeKey]);
  }

  return cloneTemplate(DEFAULT_DAILY_TEMPLATE);
}

export function flattenDailyTemplateItems(template) {
  const sections = Array.isArray(template?.sections) ? template.sections : [];
  const flattened = [];

  for (const section of sections) {
    const sectionId = (section?.id || "").toString().trim();
    const sectionTitle = (section?.title || "").toString().trim();
    const items = Array.isArray(section?.items) ? section.items : [];

    for (const item of items) {
      const itemId = (item?.id || "").toString().trim();
      const itemLabel = (item?.label || "").toString().trim();

      if (!itemId || !itemLabel) {
        continue;
      }

      flattened.push({
        sectionId,
        sectionTitle,
        id: itemId,
        label: itemLabel,
        required: item?.required !== false
      });
    }
  }

  return flattened;
}

export function getDailyTemplateOverrideNotes() {
  return {
    bySerialCount: Object.keys(TEMPLATE_OVERRIDES_BY_SERIAL).length,
    byTypeCount: Object.keys(TEMPLATE_OVERRIDES_BY_TYPE).length
  };
}
