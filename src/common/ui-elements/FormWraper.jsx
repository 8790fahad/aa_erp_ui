import { CustomButton } from "components/UI";
import { StepBar } from "components/UI";
import React, { useState } from "react";
import { Check,ArrowLeft,ArrowRight } from "react-feather";
import { useLocation } from "react-router";
import { Card } from "react-bootstrap";
import { themeClass } from "../../variables";

function FormWrapper(props) {
  const {
    steps = [],
    handleSubmit = (f) => f,
    barWidth = "20vw",
    loading = false,
  } = props;
  const [step, setStep] = useState(0);
  const location = useLocation();

  const goNext = () => {
    setStep((prev) => prev + 1);
  };

  const goBack = () => {
    setStep((prev) => prev - 1);
  };
  // Generate Certificate
  return (
    <div className={`border border-primary rounded ${themeClass}`}>
      {/* <CardHeader className={+ themeClass + "m-0 p-0" }> */}
      <center>
        <StepBar
          barWidth={barWidth}
          current={step}
          items={steps}
          onItemClick={(i) => setStep(i)}
        />
      </center>
      {/* </CardHeader> */}
      <Card.Body>{props.children.filter((item, i) => step === i)}</Card.Body>
      <div
        className={`m-0 p-0 d-flex flex-row ${
          step !== 0 ? "justify-content-between" : "justify-content-end"
        } p-1`}
      >
        {step !== 0 && (
          <CustomButton
            className="px-6"
            outline
            color="primary"
            onClick={goBack}
          >
            <ArrowLeft className="mr-1" size={20} /> Back
          </CustomButton>
        )}
        {step === steps.length - 1 ? (
          location.pathname ===
          "/general-takaful/proposals/motor-takaful/new" ? (
            <CustomButton
              className="px-6"
              color="primary"
              onClick={handleSubmit}
              loading={loading}
            >
              <Check className="mr-1" size={20} /> POST
            </CustomButton>
          ) : (
            <CustomButton
              className="px-6"
              color="primary"
              onClick={handleSubmit}
              loading={loading}
            >
              <Check className="mr-1" size={20} /> Submit
            </CustomButton>
          )
        ) : (
          <CustomButton className="px-6" color="primary" onClick={goNext}>
            Next <ArrowRight className="ml-1" size={20} />
          </CustomButton>
        )}
      </div>
    </div>
  );
}

export default FormWrapper;
