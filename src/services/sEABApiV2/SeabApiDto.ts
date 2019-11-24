class SeabApiDto {

    static SPEED_VALUE = {
        0: 300,
        1: 600,
        2: 1200,
        3: 2400,
        4: 4800,
        5: 9600,
        6: 19200,
        7: 38400, //(niedostępna w trybie rejestrowym)
    }

    transmissionMarkToSpeedValue(mark: string | number) {
        return SeabApiDto.SPEED_VALUE[mark]
    }

}

export default new SeabApiDto()
