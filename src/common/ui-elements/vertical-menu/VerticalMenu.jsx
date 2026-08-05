import { ChevronDownIcon, ChevronLeftIcon, Icon } from "evergreen-ui";


function VerticalMenu(props) {
  return (
    <div className="list-group">
      {props.title ? (
        <span
          className="list-group-item list-group-item-action  font-weight-bold  bg-primary text-white "
          style={{
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
          }}
          onClick={() => props.onClick()}
          onClose={() => !props.onClick()}
        >
          <span>{props.title}</span>
          <span>
            {props.isOpen ? (
              <Icon icon={ChevronDownIcon} size={20} />
            ) : (
              <Icon icon={ChevronLeftIcon} size={20} />
            )}
          </span>
        </span>
      ) : null}
      {props.children}
    </div>
  );
}

export default VerticalMenu;
