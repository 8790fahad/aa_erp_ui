import React from "react";
import "./step-bar.css";

let itemStyle = {
  display: "flex",
  flexDirection: "row",
  justifyContent: "center",
};

const StepBar = ({
  items = [],
  current = "",
  onItemClick = (f) => f,
  barWidth = "23vw",
}) => {
  return (
    <div className="mother">
      <div className="motherwrapper">
        <div className="arrow-steps clfix">
          {items.map((_item, index) => (
            <div
              style={{ ...itemStyle, width: barWidth }}
              onClick={() => onItemClick(index)}
              className={`step ${index === current ? "current" : ""}`}
              key={index}
            >
              <span className="font-weight-bold">{_item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StepBar;
