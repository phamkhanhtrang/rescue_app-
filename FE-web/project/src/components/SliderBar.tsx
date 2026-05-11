import React from "react";

interface SliderBarProps {
    min: number;
    max: number;
    value: number;
    onChange: (value: number) => void;
}

const SliderBar: React.FC<SliderBarProps> = ({ min, max, value, onChange }) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange(Number(event.target.value));
    };

    return (
        <div className="slider-bar">
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={handleChange}
                className="slider"
            />
            <div className="slider-value">{value}</div>
        </div>
    );
};

export default SliderBar;