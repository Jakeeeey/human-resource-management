import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isHireStepSkipped,
  matchesHireSkipStep,
  toHireStepKebabName,
} from "./hire-skip-steps.ts";

function onboardingTaskMaterializeStep() {}
function signingFilingStep() {}
function jobOfferFilingStep() {}
function erAccessStep() {}
function hiringDocumentsFilingStep() {}
function accessProvisioningStep() {}

const ALL_STEPS = [
  onboardingTaskMaterializeStep,
  signingFilingStep,
  jobOfferFilingStep,
  erAccessStep,
  hiringDocumentsFilingStep,
  accessProvisioningStep,
];

const KEBAB_BY_FUNCTION = {
  onboardingTaskMaterializeStep: "onboarding-task-materialize",
  signingFilingStep: "signing-filing",
  jobOfferFilingStep: "job-offer-filing",
  erAccessStep: "er-access",
  hiringDocumentsFilingStep: "hiring-documents-filing",
  accessProvisioningStep: "access-provisioning",
};

describe("toHireStepKebabName", () => {
  it("derives every registered step kebab name from its function name", () => {
    for (const step of ALL_STEPS) {
      assert.equal(
        toHireStepKebabName(step.name),
        KEBAB_BY_FUNCTION[step.name]
      );
    }
  });
});

describe("matchesHireSkipStep kebab form", () => {
  it("matches the kebab STEP_NAME constant against its step", () => {
    assert.equal(
      matchesHireSkipStep(
        onboardingTaskMaterializeStep,
        "onboarding-task-materialize"
      ),
      true
    );
  });
  it("matches every registered step kebab name against its own step", () => {
    for (const step of ALL_STEPS) {
      assert.equal(
        matchesHireSkipStep(step, KEBAB_BY_FUNCTION[step.name]),
        true
      );
    }
  });
  it("does not match a kebab name against a different step", () => {
    assert.equal(
      matchesHireSkipStep(signingFilingStep, "onboarding-task-materialize"),
      false
    );
  });
});

describe("matchesHireSkipStep function-name form", () => {
  it("matches the function name against its step", () => {
    assert.equal(
      matchesHireSkipStep(
        onboardingTaskMaterializeStep,
        "onboardingTaskMaterializeStep"
      ),
      true
    );
  });
  it("matches every registered function name against its own step", () => {
    for (const step of ALL_STEPS) {
      assert.equal(matchesHireSkipStep(step, step.name), true);
    }
  });
  it("does not match a function name against a different step", () => {
    assert.equal(
      matchesHireSkipStep(signingFilingStep, "onboardingTaskMaterializeStep"),
      false
    );
  });
});

describe("matchesHireSkipStep unrelated input", () => {
  it("matches nothing for an unrelated string", () => {
    for (const step of ALL_STEPS) {
      assert.equal(matchesHireSkipStep(step, "does-not-exist"), false);
    }
  });
  it("matches nothing for a near-miss with the Step suffix kept", () => {
    assert.equal(
      matchesHireSkipStep(
        onboardingTaskMaterializeStep,
        "onboarding-task-materialize-step"
      ),
      false
    );
  });
});

describe("isHireStepSkipped", () => {
  it("matches nothing for an empty skip list", () => {
    assert.equal(isHireStepSkipped(onboardingTaskMaterializeStep, []), false);
  });
  it("matches nothing for an absent skip list", () => {
    assert.equal(
      isHireStepSkipped(onboardingTaskMaterializeStep, undefined),
      false
    );
    assert.equal(isHireStepSkipped(onboardingTaskMaterializeStep, null), false);
  });
  it("skips only the named step in a mixed list", () => {
    const skipSteps = ["onboarding-task-materialize"];
    assert.equal(
      isHireStepSkipped(onboardingTaskMaterializeStep, skipSteps),
      true
    );
    assert.equal(isHireStepSkipped(signingFilingStep, skipSteps), false);
  });
  it("skips all steps for the signing-provision function-name list", () => {
    const skipSteps = ALL_STEPS.map((step) => step.name);
    for (const step of ALL_STEPS) {
      assert.equal(isHireStepSkipped(step, skipSteps), true);
    }
  });
});
