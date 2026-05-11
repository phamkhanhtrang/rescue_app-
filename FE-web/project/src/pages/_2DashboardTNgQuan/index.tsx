import React, { useState } from "react";
import SliderBar from "../../components/SliderBar";

export default function Page() {
	const [sliderValue, setSliderValue] = useState(50); // Default value for the slider

	const handleSliderChange = (value) => {
		setSliderValue(value);
		alert(`Slider value changed to: ${value}`);
	};

	return (
		<div className="flex flex-col bg-white">
			<div className="self-stretch bg-[#F8F9FA]">
				<div className="flex items-center self-stretch">
					{/* Other components and layout elements */}
					<SliderBar 
						min={0} 
						max={100} 
						value={sliderValue} 
						onChange={handleSliderChange} 
					/>
					{/* Other components and layout elements */}
				</div>
			</div>
		</div>
	);
}