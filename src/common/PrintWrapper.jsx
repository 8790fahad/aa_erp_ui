

function PrintWrapper(props) {

  return (
    <>
      <style>
        {`@media print {
              table {
                font-size: 75%;
                table-layout: fixed;
                width: 100%;
              }
              
              table {
                border-collapse: collapse;
                border-spacing: 2px;
              }
              
              th,
              td {
                border-width: 1px;
                padding: 0.5em;
                position: relative;
                text-align: left;
              }
              
              th,
                td {
                    border-radius: 0.25em;
                    border-style: solid;
                }
                
                th {
                    background: #EEE;
                    border-color: #BBB;
                }
                
                td {
                    border-color: #DDD;
                }
                .text-right {
                    text-align: right;
                }
                .text-center {
                    text-align: center;
                }
                .font-weight-bold {
                    font-weight: bold;
                }
                .print-start{
                    margin: 2em;
                    margin-top: 4em;
                }
                .print-only{
                  display: block;
                }
            }

            @media screen {
              .print-only{
                display: none;
              } 
           }   
          `}
      </style>

      <div className="print-start">
        <div className="print-only">
          <h5 className="text-center">{props.title}</h5>
          <h3 className="text-center">{props.from} - {props.to}</h3>
        </div>
        {props.children}
      </div>
    </>
  );
}

export default PrintWrapper;
