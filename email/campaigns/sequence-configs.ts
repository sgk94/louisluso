import type { SequenceConfig } from "../sequences.ts";

export const SEQUENCES: Record<string, SequenceConfig> = {
  "vision-source-outreach": {
    name: "Vision Source Member Outreach",
    steps: [
      {
        template: "outreach-intro",
        subject: "Premium Asian-Fit Frames for Your Practice — Louis Luso",
        delayDays: 0,
        skipIf: "none",
      },
      {
        template: "outreach-followup-1",
        subject: "Quick follow-up — Louis Luso frames",
        delayDays: 3,
        skipIf: "replied",
      },
      {
        template: "outreach-followup-2",
        subject: "Last note — sample frames available",
        delayDays: 7,
        skipIf: "replied",
      },
    ],
  },

  "distributor-outreach": {
    name: "Distributor Outreach",
    steps: [
      {
        template: "outreach-intro",
        subject: "Wholesale Partnership — Louis Luso Eyewear",
        delayDays: 0,
        skipIf: "none",
      },
      {
        template: "outreach-followup-1",
        subject: "Following up — Louis Luso wholesale",
        delayDays: 5,
        skipIf: "replied",
      },
      {
        template: "outreach-followup-2",
        subject: "One more note — Louis Luso partnership",
        delayDays: 10,
        skipIf: "replied",
      },
    ],
  },
};
