/* eslint-disable no-unused-vars */
// import { Label } from 'evergreen-ui'
import CustomButton from '@/common/Custom/CustomButton'
import CustomCard from '@/common/Custom/CustomCard2'
import React, { useState } from 'react'
import { Alert } from 'reactstrap'
import { CardBody, Col, Row, Label, Input } from 'reactstrap/lib'

export default function ChientAccountStatement() {
    const _form = {
        start_from: "",
        ent_at: "",
        account_name: "",
        balance: "",
    }
    const [form, setForm] = useState(_form)
    const [data, useData] = useState([])

    const handleChange = ({ target: { name, value } }) => {
        setForm((p) => ({ ...p, [name]: value }))
    }
     const handleAdd = () => {
    //    _postApi("classes", form, () => {
        setForm(_form)
    //    },
    //    (err) => console.log(err)
    //    )
          console.log(_form)
        }
    return (
        <div>
            <CustomCard header="Client Account">
                <CardBody>
                    <Row>
                        <Col md={4}>
                            <Label>Start From:</Label>
                            <Input type='date' name='start_from'
                                value={form.start_from}
                                onChange={handleChange} />
                        </Col>
                        <Col md={4}></Col>
                        <Col md={4}>
                            <Label>Ent At:</Label>
                            <Input type='date' name='ent_at'
                                value={form.ent_at}
                                onChange={handleChange} />
                        </Col>
                        <Col md={4}>
                            <Label>Account Name</Label>
                            <Input type='text' name='account_name'
                                value={form.account_name}
                                onChange={handleChange} />
                        </Col>
                        <Col md={4}>
                            <Label>Balance</Label>
                            <Input type='number' name='balance'
                                value={form.balance}
                                onChange={handleChange} />
                        </Col>
                        <Col md={4}>
                            <CustomButton
                                className="mt-4"
                                onClick={handleAdd}
                                >
                                Print Report
                            </CustomButton>
                        </Col>
                    </Row>
                    <center>
                        <Alert className='mt-3'>
                            No data to view
                        </Alert>
                    </center>
                </CardBody>
            </CustomCard>
        </div>
    )
}
