import { Component } from "react";

import { Switch, SwitchLabel, SwitchRadio, SwitchSelection } from "./style.jsx";

const titleCase = (str) =>
  str
    .split(/\s+/)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

const ClickableLabel = ({ title, onChange, id }) => (
  <SwitchLabel onClick={() => onChange(title)} className={id}>
    {titleCase(title)}
  </SwitchLabel>
);

const ConcealedRadio = ({ value, selected, onChange }) => (
  <SwitchRadio
    type="radio"
    name="switch"
    onChange={onChange}
    defaultChecked
    checked={selected === value || ""}
  />
);

class ToggleSwitch extends Component {
  state = { selected: this.props.selected };

  handleChange = (val) => {
    this.setState({ selected: val });
    this.props.onChange("status_true", val, this.props.index);
  };

  selectionStyle = () => {
    return {
      left: `${(this.props.options.indexOf(this.state.selected) / 3) * 100}%`,
    };
  };

  render() {
    const { selected } = this.state;
    return (
      <>
        <h6 className="mb-2">{this.props.label}</h6>
        <Switch>
          {this.props.options.map((val, i) => {
            return (
              <span key={i}>
                <ConcealedRadio
                  defaultChecked
                  value={val}
                  selected={selected}
                />
                <ClickableLabel title={val} onChange={this.handleChange} />
              </span>
            );
          })}
          <SwitchSelection style={this.selectionStyle()} />
        </Switch>
      </>
    );
  }
}

export default ToggleSwitch;
