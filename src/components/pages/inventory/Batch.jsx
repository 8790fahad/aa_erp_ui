import React from "react";
import BatchGrid from "./BatchGrid";
import { Container } from "reactstrap";
import CustomCard from "@/common/Custom/CustomCard2";

export default function Batch() {
  return (
    <Container>
      <CustomCard back header="Batch management">
        <BatchGrid />
      </CustomCard>
    </Container>
  );
}
