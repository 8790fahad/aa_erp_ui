
import { RadioBox } from ".";

function RadioGroup(props) {
  const {
    container = "",
    options = [],
    onChange = (f) => f,
    value = "",
    label = "",
    name = "",
  } = props;

  return (
    <div className={container}>
      <h6 className={"font-weight-bold"}>{label}</h6>
      <br />
      <div className="row">
        {/* {JSON.stringify({ name, value })} */}
        {options.map((_item, _i) => (
          <RadioBox
            key={_i}
            container="col-md-6"
            label={_item.label}
            name={name}
            checked={_item.name === value}
            onChange={() => onChange(name, _item.name)}
          />
        ))}
      </div>
    </div>
  );
}

export default RadioGroup;
