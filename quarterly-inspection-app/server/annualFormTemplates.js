const DEFAULT_ANNUAL_TEMPLATE = {
  templateId: "forklift_annual_v1",
  title: "Forklift Annual Safety Inspection",
  sections: [
    {
      id: "core_inspection",
      title: "Core Inspection",
      items: [
        {
          id: "annual_chains_measure_wear",
          label: "Chains - measure of wear",
          required: true
        },
        {
          id: "annual_forks_welds_lock_pins_fork_bars",
          label: "Forks - welds, lock pins, and fork bars",
          required: true
        },
        {
          id: "annual_fork_wear_measure",
          label: "Fork wear - measure",
          required: true
        },
        {
          id: "annual_carriage_welds_backrest_bearings_bars",
          label: "Carriage - welds, backrest, bearings, bars",
          required: true
        },
        {
          id: "annual_mast_trunnions_crosshead_bars_welds_bearings",
          label: "Mast - trunnions, crosshead bars, welds, bearings",
          required: true
        },
        {
          id: "annual_lift_cylinders_leaks_hosing_anchors_drift_lines",
          label: "Lift cylinders - leaks, hosing, anchors, drift, lines",
          required: true
        },
        {
          id: "annual_tilt_cylinders_leaks_hosing_tilt_range_drift",
          label: "Tilt cylinders - leaks, hosing, tilt range, drift",
          required: true
        },
        {
          id: "annual_frame_welds_alignment",
          label: "Frame welds - alignment",
          required: true
        },
        {
          id: "annual_vehicle_capacity_rating_plate",
          label: "Vehicle capacity rating plate (absent or present)",
          required: true
        },
        {
          id: "annual_counterweight_mounts",
          label: "Counterweight mounts",
          required: true
        },
        {
          id: "annual_overhead_guard_corners_welds_mounts",
          label: "Overhead guard - corners, welds, mounts",
          required: true
        },
        {
          id: "annual_cab_welds_mounts_guards",
          label: "Cab - welds, mounts, guards",
          required: true
        },
        {
          id: "annual_tires_wheels_tread_rim",
          label: "Tires, wheels, tread, and rim",
          required: true
        },
        {
          id: "annual_attachments_welds_capacity",
          label: "Attachments - welds, capacity",
          required: true
        },
        {
          id: "annual_hydraulics_control_valve_neutral",
          label: "Hydraulics - control valve returns to neutral",
          required: true
        },
        {
          id: "annual_brakes_operational",
          label: "Brakes - operational",
          required: true
        },
        {
          id: "annual_brake_emergency",
          label: "Emergency brake",
          required: true
        },
        {
          id: "annual_steering",
          label: "Steering",
          required: true
        },
        {
          id: "annual_electrical_warning_lights_horn",
          label: "Electrical - warning systems, lights, horn",
          required: true
        },
        {
          id: "annual_batteries",
          label: "Batteries",
          required: true
        },
        {
          id: "annual_emissions_check",
          label: "Emissions check",
          required: true
        },
        {
          id: "annual_engine_oil_level",
          label: "Engine oil level",
          required: true
        }
      ]
    },
    {
      id: "scissor_only",
      title: "Scissor Lifts Only",
      items: [
        {
          id: "annual_scissor_platform_rails_chains_latches",
          label: "Platform rails, chains, latches",
          required: false
        },
        {
          id: "annual_scissor_hydraulics_control_portion_pipes",
          label: "Hydraulics and control portion pipes",
          required: false
        },
        {
          id: "annual_scissor_pump_fits",
          label: "Pump fittings",
          required: false
        }
      ]
    }
  ]
};

// Override templates by exact serial (case-insensitive).
const TEMPLATE_OVERRIDES_BY_SERIAL = {};

// Override templates by equipment type (case-insensitive).
const TEMPLATE_OVERRIDES_BY_TYPE = {};

function normalizeKey(value) {
  return (value || "").toString().trim().toLowerCase();
}

function cloneTemplate(template) {
  return JSON.parse(JSON.stringify(template));
}

export function getAnnualTemplateForEquipment({ serialNumber, type }) {
  const serialKey = normalizeKey(serialNumber);
  if (serialKey && TEMPLATE_OVERRIDES_BY_SERIAL[serialKey]) {
    return cloneTemplate(TEMPLATE_OVERRIDES_BY_SERIAL[serialKey]);
  }

  const typeKey = normalizeKey(type);
  if (typeKey && TEMPLATE_OVERRIDES_BY_TYPE[typeKey]) {
    return cloneTemplate(TEMPLATE_OVERRIDES_BY_TYPE[typeKey]);
  }

  return cloneTemplate(DEFAULT_ANNUAL_TEMPLATE);
}

export function flattenAnnualTemplateItems(template) {
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
