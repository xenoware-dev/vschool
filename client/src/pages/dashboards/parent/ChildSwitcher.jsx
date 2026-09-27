import { Segmented } from '../../../components/ui';

// Only rendered for families with more than one child enrolled
const ChildSwitcher = ({ kids, child, onSelect }) =>
  kids.length > 1 ? (
    <Segmented
      value={child?._id}
      onChange={onSelect}
      options={kids.map((c) => ({ value: c._id, label: c.name.split(' ')[0] }))}
    />
  ) : null;

export default ChildSwitcher;
